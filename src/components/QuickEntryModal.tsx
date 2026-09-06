import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, View,
} from 'react-native';
import { useTheme } from '@/lib/theme';
import { useCarriedOverBalance, usePostTransaction, useSiteHistory, useUpdateNote } from '@/lib/api';
import { money, num, parseAmount, periodLabel } from '@/lib/format';
import type { LedgerRow, ModuleType } from '@/lib/types';
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

export function QuickEntryModal({ row, module, period, canEdit, onClose, onSuccess, onSiteUpdated, onNavigateToPeriod }: {
  row: LedgerRow | null;
  module: ModuleType;
  period: string;
  /** Site adi / ucret duzenleme butonunu gosterip gostermeyecegi (admin/operator) */
  canEdit: boolean;
  onClose: () => void;
  onSuccess: (row: LedgerRow) => void;
  /** Site bilgisi (ad/ucret) basariyla guncellendiginde tetiklenir */
  onSiteUpdated: (name: string) => void;
  /** "Ödeme Geçmişi" kartından tıklanınca o ayın tablosuna ve site detayına geçilir */
  onNavigateToPeriod: (period: string, row: LedgerRow) => void;
}) {
  const { c, spacing, radius } = useTheme();
  const visible = !!row;
  const mutation = usePostTransaction(module, period);
  const updateNote = useUpdateNote(module, period);
  const history = useSiteHistory(row?.site_id, module, period);
  const carriedOver = useCarriedOverBalance(row?.site_id, module, period);

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

  const carriedOverAmount = carriedOver.data ?? 0;
  const hasCarriedOver = Math.abs(carriedOverAmount) >= 0.01;

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

  function handleSiteUpdated(name: string) {
    setEditSiteOpen(false);
    onSiteUpdated(name);
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
            style={{ backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden', maxHeight: '88%' }}
          >
            <View style={{
              padding: spacing.lg,
              borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
              flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm,
            }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="h3">Hızlı Kayıt</Txt>
                <Txt variant="small" color={c.textMuted} numberOfLines={1}>{row.site_name}</Txt>
              </View>
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

            <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
              {hasCarriedOver && (
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
                <MiniStat label="Bu Ay Kalan" value={row.balance} color={num(row.balance) > 0 ? c.danger : c.ok} />
              </View>

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
              flexDirection: 'row', gap: spacing.md, padding: spacing.lg,
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
