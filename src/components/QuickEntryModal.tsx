import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, View, useWindowDimensions,
} from 'react-native';
import { useTheme } from '@/lib/theme';
import { usePostTransaction, useSiteHistory, useUpdateNote } from '@/lib/api';
import { currentPeriod, money, num, parseAmount, periodFileLabel, periodLabel } from '@/lib/format';
import { exportSiteStatementCsv } from '@/lib/export';
import { finalBalanceState, overpaidAmount, type LedgerRow, type ModuleType } from '@/lib/types';
import { StatusPill } from './ledger';
import { EditSiteModal } from './EditSiteModal';
import { Button, ConfirmModal, Field, Txt } from './ui';

/** Cift dokunma kalkani: modal her acildiginda benzersiz bir istek kimligi uretilir */
function makeRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

interface NoteItem {
  ledgerId: string;
  period: string;
  notes: string;
  isLocked: boolean;
}

export function QuickEntryModal({ row, module, period, canEdit, onClose, onSuccess, onSiteUpdated, onNavigateToPeriod, onOpenStatement }: {
  row: LedgerRow | null;
  module: ModuleType;
  period: string;
  /** Site adi / ucret duzenleme butonunu gosterip gostermeyecegi (admin/operator) */
  canEdit: boolean;
  onClose: () => void;
  onSuccess: (row: LedgerRow) => void;
  /** Site bilgisi guncellendiginde/feshedildiginde/aktiflestirildiginde gosterilecek mesaj */
  onSiteUpdated: (message: string) => void;
  /** "Ödeme Geçmişi" kartından tıklanınca o ayın tablosuna ve site detayına geçilir */
  onNavigateToPeriod: (period: string, row: LedgerRow) => void;
  /**
   * "Tüm Ayları Görüntüle" — Cari Ekstre modalini AYRI bir ust seviye Modal
   * olarak actirmak icin ust bilesene devredilir (Modal-icinde-Modal
   * yerlestirmesinden kacinilir; bazi mobil tarayicilarda ic ice Modal'larda
   * dokunmatik scroll calismama sorunu yasanmisti — bkz. kullanici geri bildirimi).
   */
  onOpenStatement: (siteName: string, currentRow: LedgerRow, historyRows: LedgerRow[]) => void;
}) {
  const { c, spacing, radius } = useTheme();
  // Android'de yuzdesel maxHeight bazen flex zincirinde guvenilir sekilde
  // cozumlenmiyor (ScrollView "donuk" kaliyor) — bkz. kullanici geri
  // bildirimi, gercek cihaz/Expo Go testi. Sabit piksel deger daha guvenli.
  const { height: windowHeight } = useWindowDimensions();
  const boxMaxHeight = windowHeight * 0.88;
  const visible = !!row;
  const mutation = usePostTransaction(module, period);
  const updateNote = useUpdateNote(module, period);
  const history = useSiteHistory(row?.site_id, module, period);

  const [extraText, setExtraText] = useState('');
  const [paymentText, setPaymentText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [currentNotes, setCurrentNotes] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(makeRequestId);
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);
  const [editSiteOpen, setEditSiteOpen] = useState(false);

  // Modal yeni bir satir icin acildiginda alanlar ve istek kimligi sifirlanir
  useEffect(() => {
    if (visible) {
      setExtraText('');
      setPaymentText('');
      setNoteText('');
      setCurrentNotes(row?.notes ?? null);
      setRequestId(makeRequestId());
      mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.ledger_id, visible]);

  if (!row) return null;

  const carriedOverAmount = num(row.carried_over_balance);
  const hasCarriedOver = Math.abs(carriedOverAmount) >= 0.01;
  // Gecmisten borc VARKEN bu ay fazla odeme girildiyse (bkz. kullanici geri
  // bildirimi): iki ayri stat (Gecmis Borc / Bu Ay Kalan) yan yana kafa
  // karistirabilir — net durumu tek, anlasilir bir mesajda birlestiririz.
  const overpaidThisMonth = num(row.balance) < -0.01;
  const netAfterCarryover = carriedOverAmount + num(row.balance);
  const carryoverCleared = carriedOverAmount > 0 && overpaidThisMonth && netAfterCarryover <= 0.01;
  const carryoverStillOwed = carriedOverAmount > 0 && overpaidThisMonth && netAfterCarryover > 0.01;
  const extraCreditAfterClear = carryoverCleared && netAfterCarryover < -0.01 ? -netAfterCarryover : 0;
  // Gecmisten borc yokken sadece bu ay fazla odeme girildiyse: ham negatif
  // "Bu Ay Kalan" yerine pozitif "Bu Ay Fazla Ödenen" gosterilir.
  const thisMonthOverpaidAmount = !carryoverCleared && !carryoverStillOwed ? overpaidAmount(num(row.balance)) : null;
  const thisMonthRemaining = thisMonthOverpaidAmount !== null
    ? { label: 'Bu Ay Fazla Ödenen', value: String(thisMonthOverpaidAmount), color: c.ok }
    : { label: 'Bu Ay Kalan', value: row.balance, color: num(row.balance) > 0 ? c.danger : c.ok };
  const isPastPeriod = row.period < currentPeriod();
  const finalState = finalBalanceState(num(row.site_current_balance));

  const noteItems: NoteItem[] = [];
  if (currentNotes && currentNotes.trim()) {
    noteItems.push({ ledgerId: row.ledger_id, period: row.period, notes: currentNotes, isLocked: row.is_locked });
  }
  for (const h of history.data ?? []) {
    if (h.notes && h.notes.trim()) {
      noteItems.push({ ledgerId: h.ledger_id, period: h.period, notes: h.notes, isLocked: h.is_locked });
    }
  }

  function handleClose() {
    if (mutation.isPending) return;
    onClose();
  }

  function handleSiteUpdated(message: string) {
    setEditSiteOpen(false);
    onSiteUpdated(message);
    onClose();
  }

  function handleSave() {
    if (!row) return;
    const note = noteText.trim();
    mutation.mutate(
      {
        siteId: row.site_id,
        period,
        extra: parseAmount(extraText),
        payment: parseAmount(paymentText),
        note: note || undefined,
        requestId,
      },
      {
        onSuccess: () => {
          if (note) {
            setCurrentNotes(prev => (prev && prev.trim() ? `${prev}\n${note}` : note));
          }
          onSuccess(row);
        },
      },
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <Pressable
          onPress={handleClose}
          style={{ flex: 1, backgroundColor: 'rgba(11,21,38,0.55)', justifyContent: 'center', padding: spacing.xl }}
        >
          <Pressable
            onPress={e => e.stopPropagation()}
            style={{
              backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden',
              maxHeight: boxMaxHeight, flexShrink: 1,
            }}
          >
            <View style={{
              padding: spacing.lg, flexShrink: 0,
              borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
              flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm,
            }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="h3">Hızlı Kayıt</Txt>
                <Txt variant="small" color={c.textMuted} numberOfLines={1}>{row.site_name}</Txt>
              </View>
              <Pressable
                onPress={() => onOpenStatement(row.site_name, row, history.data ?? [])}
                hitSlop={8}
                style={({ pressed }) => ({
                  paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
                  borderRadius: radius.sm, backgroundColor: pressed ? c.surfaceAlt : 'transparent',
                })}
              >
                <Txt variant="small" color={c.accent} style={{ fontWeight: '700' }}>📋 Tüm Ayları Görüntüle</Txt>
              </Pressable>
              {canEdit && (
                <Pressable
                  onPress={() => setEditSiteOpen(true)}
                  hitSlop={8}
                  style={({ pressed }) => ({
                    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
                    borderRadius: radius.sm, backgroundColor: pressed ? c.surfaceAlt : 'transparent',
                  })}
                >
                  <Txt variant="small" color={c.accent} style={{ fontWeight: '700' }}>✎ Düzenle</Txt>
                </Pressable>
              )}
            </View>

            <ScrollView
              style={{ flexShrink: 1 }}
              contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
              keyboardShouldPersistTaps="handled"
            >
              {carryoverCleared && (
                <View style={{ backgroundColor: c.okSoft, borderRadius: radius.md, padding: spacing.md, gap: 2 }}>
                  <Txt variant="tiny" color={c.ok}>✓ Geçmiş Borç Kapatıldı / Sıfırlandı</Txt>
                  {extraCreditAfterClear >= 0.01 && (
                    <Txt variant="small" color={c.ok}>+{money(extraCreditAfterClear)} sonraki aya devreder</Txt>
                  )}
                </View>
              )}
              {carryoverStillOwed && (
                <View style={{ backgroundColor: c.dangerSoft, borderRadius: radius.md, padding: spacing.md, gap: 2 }}>
                  <Txt variant="tiny" color={c.danger}>Bu Ayki Fazla Ödemeye Rağmen Kalan Geçmiş Borç</Txt>
                  <Txt variant="h3" color={c.danger}>{money(netAfterCarryover)}</Txt>
                </View>
              )}
              {hasCarriedOver && !carryoverCleared && !carryoverStillOwed && (
                <View style={{
                  backgroundColor: carriedOverAmount > 0 ? c.dangerSoft : c.okSoft,
                  borderRadius: radius.md, padding: spacing.md, gap: 2,
                }}>
                  <Txt variant="tiny" color={carriedOverAmount > 0 ? c.danger : c.ok}>
                    {carriedOverAmount > 0 ? 'Geçmişten Devreden Borç' : 'Geçmişten Devreden Alacak (Fazla Ödeme)'}
                  </Txt>
                  <Txt variant="h3" color={carriedOverAmount > 0 ? c.danger : c.ok}>
                    {money(Math.abs(carriedOverAmount))}
                  </Txt>
                </View>
              )}

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <MiniStat label="Bu Ay Toplam" value={row.total_due} color={c.textMuted} />
                <MiniStat label="Bu Ay Ödenen" value={row.net_paid} color={c.ok} />
                <MiniStat label={thisMonthRemaining.label} value={thisMonthRemaining.value} color={thisMonthRemaining.color} />
              </View>

              {isPastPeriod && (
                <View style={{
                  backgroundColor: finalState.kind === 'debt' ? c.dangerSoft : c.okSoft,
                  borderRadius: radius.md, padding: spacing.md, gap: 2,
                }}>
                  <Txt variant="tiny" color={finalState.kind === 'debt' ? c.danger : c.ok}>
                    📌 Sitenin Güncel Bakiyesi (Bugün)
                  </Txt>
                  <Txt variant="h3" color={finalState.kind === 'debt' ? c.danger : c.ok}>
                    {finalState.kind === 'debt'
                      ? `${money(finalState.amount)} Borçlu`
                      : finalState.kind === 'credit'
                        ? `${money(finalState.amount)} Alacaklı (Fazla Ödeme)`
                        : 'Sıfırlandı (Borcu Yok)'}
                  </Txt>
                </View>
              )}

              <Txt variant="tiny" color={c.textFaint}>
                Ödeme Günü: {row.service_day ? `Ayın ${row.service_day}'i` : 'Belirtilmemiş'}
              </Txt>

              <Field
                label="Ekstra Hizmet / Malzeme Çıktı Mı? (₺)"
                placeholder="0"
                keyboardType="decimal-pad"
                value={extraText}
                onChangeText={setExtraText}
              />
              <Field
                label="Tahsil Edilen Tutar (₺)"
                placeholder="0"
                keyboardType="decimal-pad"
                value={paymentText}
                onChangeText={setPaymentText}
              />

              <View style={{ gap: spacing.sm }}>
                <Txt variant="h3">Ödeme Geçmişi</Txt>
                {history.isLoading && <Txt variant="small" color={c.textFaint}>Yükleniyor…</Txt>}
                {history.isError && <Txt variant="small" color={c.textFaint}>Geçmiş şu an yüklenemedi.</Txt>}
                {!history.isLoading && !history.isError && (history.data?.length ?? 0) === 0 && (
                  <Txt variant="small" color={c.textFaint}>Bu siteye ait başka dönem kaydı yok.</Txt>
                )}
                {(history.data ?? []).map(h => (
                  <Pressable
                    key={h.ledger_id}
                    onPress={() => onNavigateToPeriod(h.period, h)}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
                      backgroundColor: pressed ? c.border : c.surfaceAlt, borderRadius: radius.sm,
                    })}
                  >
                    <Txt variant="small" color={c.textMuted}>{periodLabel(h.period)}</Txt>
                    <StatusPill statusKey={h.status_key} label={h.status_label} small />
                    <Txt variant="moneySm" color={num(h.balance) > 0 ? c.danger : c.ok}>{money(h.balance)}</Txt>
                  </Pressable>
                ))}
              </View>

              <Field
                label="Bu Ay İçin Not Ekle"
                placeholder="Örn: Yönetici haftaya verecek"
                value={noteText}
                onChangeText={setNoteText}
                multiline
                numberOfLines={3}
                style={{ minHeight: 76, textAlignVertical: 'top' }}
              />

              {noteItems.length > 0 && (
                <View style={{ gap: spacing.sm }}>
                  <Txt variant="h3">Notlar</Txt>
                  {noteItems.map(n => (
                    <Pressable
                      key={n.ledgerId}
                      onPress={() => setEditingNote(n)}
                      style={({ pressed }) => ({
                        backgroundColor: pressed ? c.border : c.surfaceAlt,
                        borderRadius: radius.md, padding: spacing.md, gap: 2,
                        borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
                      })}
                    >
                      <Txt variant="tiny" color={c.accent}>{periodLabel(n.period)}</Txt>
                      <Txt variant="small" color={c.text} numberOfLines={2}>{n.notes}</Txt>
                    </Pressable>
                  ))}
                </View>
              )}

              {mutation.isError && (
                <Txt variant="small" color={c.danger}>{(mutation.error as Error).message}</Txt>
              )}
            </ScrollView>

            <View style={{
              flexDirection: 'row', gap: spacing.md, padding: spacing.lg, flexShrink: 0,
              borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border,
            }}>
              <Button title="Vazgeç" variant="secondary" onPress={handleClose}
                      disabled={mutation.isPending} style={{ flex: 1 }} />
              <Button title="Kaydet" onPress={handleSave}
                      loading={mutation.isPending} style={{ flex: 1 }} />
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>

      <NoteEditModal
        note={editingNote}
        onClose={() => setEditingNote(null)}
        onSaved={(ledgerId, newNotes) => {
          if (ledgerId === row.ledger_id) setCurrentNotes(newNotes);
          setEditingNote(null);
        }}
        updateNote={updateNote}
        siteId={row.site_id}
      />

      <EditSiteModal
        visible={editSiteOpen}
        siteId={row.site_id}
        module={module}
        period={period}
        onClose={() => setEditSiteOpen(false)}
        onSuccess={handleSiteUpdated}
      />
    </Modal>
  );
}

/**
 * Siteye ozel cari ekstre: gecmisten bugune tum donemler alt alta bir liste
 * halinde. QuickEntryModal'in KENDI Modal'i disinda, ust seviyede AYRI bir
 * Modal olarak actirilir (Modal-icinde-Modal yerlestirmesinden kacinilir —
 * bazi mobil tarayicilarda ic ice Modal'larda dokunmatik scroll calismama
 * sorunu yasanmisti — bkz. kullanici geri bildirimi).
 */
export function SiteStatementModal({ visible, siteName, currentRow, historyRows, onClose }: {
  visible: boolean;
  siteName: string;
  currentRow: LedgerRow | null;
  historyRows: LedgerRow[];
  onClose: () => void;
}) {
  const { c, spacing, radius } = useTheme();
  // Android'de yuzdesel maxHeight bazen flex zincirinde guvenilir sekilde
  // cozumlenmiyor (ScrollView "donuk" kaliyor) — bkz. kullanici geri
  // bildirimi, gercek cihaz/Expo Go testi. Sabit piksel deger daha guvenli.
  const { height: windowHeight } = useWindowDimensions();
  const boxMaxHeight = windowHeight * 0.85;
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  if (!currentRow) return null;
  const rows = [currentRow, ...historyRows].slice().sort((a, b) => b.period.localeCompare(a.period));
  // Site duzeyinde: hangi donem satirina bakilirsa bakilsin AYNI deger —
  // sitenin BUGUNE kadarki nihai net bakiyesi (bkz. kullanici geri bildirimi,
  // Bozyel 4 senaryosu: gecmis kirmizilarin bugune yansiyan toplami).
  const finalState = finalBalanceState(num(currentRow.site_current_balance));

  async function handleExport() {
    if (exporting || rows.length === 0) return;
    setExporting(true);
    setExportError('');
    try {
      const fileName = `${siteName.replace(/[^\p{L}\p{N}]+/gu, '_')}_Cari_Ekstre_${periodFileLabel(currentRow!.period)}`;
      await exportSiteStatementCsv(rows, siteName, fileName);
    } catch (err) {
      setExportError('Dışa aktarma başarısız oldu.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(11,21,38,0.55)', justifyContent: 'center', padding: 24 }}
      >
        <Pressable
          onPress={e => e.stopPropagation()}
          style={{
            backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden',
            maxHeight: boxMaxHeight, flexShrink: 1,
          }}
        >
          <View style={{
            padding: spacing.lg, gap: spacing.sm, flexShrink: 0,
            borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="h3">Cari Ekstre</Txt>
                <Txt variant="small" color={c.textMuted} numberOfLines={1}>{siteName}</Txt>
              </View>
              <Pressable
                onPress={handleExport}
                disabled={exporting || rows.length === 0}
                hitSlop={8}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  backgroundColor: c.accentSoft, borderRadius: radius.pill,
                  paddingVertical: 6, paddingHorizontal: 12,
                  opacity: rows.length === 0 ? 0.4 : pressed ? 0.7 : 1,
                })}
              >
                <Txt variant="small" color={c.accent} style={{ fontWeight: '700' }}>
                  {exporting ? '…' : '⬇︎ Dışa Aktar'}
                </Txt>
              </Pressable>
            </View>
            {!!exportError && <Txt variant="tiny" color={c.danger}>{exportError}</Txt>}
            <View style={{
              backgroundColor: finalState.kind === 'debt' ? c.dangerSoft : c.okSoft,
              borderRadius: radius.md, padding: spacing.md, gap: 2,
            }}>
              <Txt variant="tiny" color={finalState.kind === 'debt' ? c.danger : c.ok} style={{ fontWeight: '700' }}>
                NİHAİ DURUM (Bugün İtibarıyla)
              </Txt>
              <Txt variant="h2" color={finalState.kind === 'debt' ? c.danger : c.ok}>
                {finalState.kind === 'debt'
                  ? `${money(finalState.amount)} Borçlu`
                  : finalState.kind === 'credit'
                    ? `${money(finalState.amount)} Alacaklı`
                    : 'Sıfırlandı / Borcu Yok'}
              </Txt>
            </View>
          </View>

          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
            {rows.map(r => {
              const balance = num(r.balance);
              const overpaid = overpaidAmount(balance);
              return (
                <View
                  key={r.ledger_id}
                  style={{
                    backgroundColor: c.surfaceAlt, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs,
                    borderWidth: r.ledger_id === currentRow.ledger_id ? 1 : 0,
                    borderColor: c.accent,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Txt variant="small" color={c.text} style={{ fontWeight: '700' }}>{periodLabel(r.period)}</Txt>
                    <StatusPill statusKey={r.status_key} label={r.status_label} small />
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
                    <MiniStat label="Aidat" value={r.base_fee} color={c.textMuted} />
                    {num(r.extra_total) > 0 && <MiniStat label="Ekstra" value={r.extra_total} color={c.warn} />}
                    <MiniStat label="Ödenen" value={r.net_paid} color={c.ok} />
                    {overpaid !== null
                      ? <MiniStat label="Fazla Ödenen" value={String(overpaid)} color={c.ok} />
                      : <MiniStat label="Kalan" value={r.balance} color={balance > 0 ? c.danger : c.ok} />}
                  </View>
                </View>
              );
            })}
            {rows.length === 0 && (
              <Txt variant="small" color={c.textFaint}>Bu siteye ait dönem kaydı yok.</Txt>
            )}
          </ScrollView>

          <View style={{ padding: spacing.lg, flexShrink: 0, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }}>
            <Button title="Kapat" variant="secondary" onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 1 }}>
      <Txt variant="tiny" color={c.textFaint}>{label}</Txt>
      <Txt variant="moneySm" color={color}>{money(value)}</Txt>
    </View>
  );
}

/** Tek bir notu duzenleme / silme alt-modali (gecmis veya bu ay farketmez) */
function NoteEditModal({ note, siteId, updateNote, onClose, onSaved }: {
  note: NoteItem | null;
  siteId: string;
  updateNote: ReturnType<typeof useUpdateNote>;
  onClose: () => void;
  onSaved: (ledgerId: string, newNotes: string | null) => void;
}) {
  const { c, spacing, radius } = useTheme();
  const [text, setText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const visible = !!note;

  useEffect(() => {
    if (note) {
      setText(note.notes);
      updateNote.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.ledgerId]);

  if (!note) return null;

  function handleSave() {
    if (!note) return;
    const trimmed = text.trim();
    updateNote.mutate(
      { ledgerId: note.ledgerId, notes: trimmed || null, siteId },
      { onSuccess: () => onSaved(note.ledgerId, trimmed || null) },
    );
  }

  function handleDelete() {
    if (!note) return;
    updateNote.mutate(
      { ledgerId: note.ledgerId, notes: null, siteId },
      { onSuccess: () => { setConfirmDelete(false); onSaved(note.ledgerId, null); } },
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(11,21,38,0.55)', justifyContent: 'center', padding: spacing.xl }}
      >
        <Pressable
          onPress={e => e.stopPropagation()}
          style={{ backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md }}
        >
          <Txt variant="h3">{periodLabel(note.period)} Notu</Txt>

          {note.isLocked ? (
            <>
              <Txt variant="small" color={c.textMuted}>{note.notes}</Txt>
              <Txt variant="tiny" color={c.textFaint}>Bu dönem kapatılmış; not değiştirilemez.</Txt>
              <Button title="Kapat" variant="secondary" onPress={onClose} />
            </>
          ) : (
            <>
              <Field
                label="Not"
                value={text}
                onChangeText={setText}
                multiline
                numberOfLines={4}
                style={{ minHeight: 96, textAlignVertical: 'top' }}
              />
              {updateNote.isError && (
                <Txt variant="small" color={c.danger}>{(updateNote.error as Error).message}</Txt>
              )}
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button title="Sil" variant="danger" onPress={() => setConfirmDelete(true)}
                        disabled={updateNote.isPending} style={{ flex: 1 }} />
                <Button title="Vazgeç" variant="secondary" onPress={onClose}
                        disabled={updateNote.isPending} style={{ flex: 1 }} />
                <Button title="Kaydet" onPress={handleSave}
                        loading={updateNote.isPending} style={{ flex: 1 }} />
              </View>
            </>
          )}
        </Pressable>
      </Pressable>

      <ConfirmModal
        visible={confirmDelete}
        title="Not silinsin mi?"
        message="Bu notu silmek üzeresiniz. Bu işlem geri alınamaz."
        confirmLabel="Sil"
        danger
        loading={updateNote.isPending}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </Modal>
  );
}
