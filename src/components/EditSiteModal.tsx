import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, View,
} from 'react-native';
import { useTheme } from '@/lib/theme';
import { useDeactivateSite, useReactivateSite, useSite, useUpdateSiteDetails } from '@/lib/api';
import { num, parseAmount, periodLabel, shiftPeriod } from '@/lib/format';
import type { ModuleType } from '@/lib/types';
import { Button, ConfirmModal, Field, Loading, Txt } from './ui';

/**
 * Site adi / aylik sabit ucret duzenleme + sozlesme feshi (pasife alma)
 * formu. Ucret degisikligi SADECE `period` ve sonrasini etkiler; sozlesme
 * feshi de sadece bir SONRAKI aydan itibaren gecerli olur — hicbir durumda
 * gecmis aylarin bilancosu bozulmaz (bkz. useUpdateSiteDetails /
 * useDeactivateSite).
 */
export function EditSiteModal({ visible, siteId, module, period, onClose, onSuccess }: {
  visible: boolean;
  siteId: string | undefined;
  module: ModuleType;
  /** Zam uygulanacaksa etkinlik tarihi: su an listede goruntulenen donem */
  period: string;
  onClose: () => void;
  /** Kaydetme/fesih/aktiflestirme basarili oldugunda gosterilecek mesaj */
  onSuccess: (message: string) => void;
}) {
  const { c, spacing, radius } = useTheme();
  const site = useSite(visible ? siteId : undefined);
  const mutation = useUpdateSiteDetails();
  const deactivate = useDeactivateSite();
  const reactivate = useReactivateSite();

  const [name, setName] = useState('');
  const [feeText, setFeeText] = useState('');
  const [nameError, setNameError] = useState('');
  const [feeError, setFeeError] = useState('');
  const [confirmDeactivateOpen, setConfirmDeactivateOpen] = useState(false);

  const effectiveTerminationPeriod = shiftPeriod(period, 1);
  const busy = mutation.isPending || deactivate.isPending || reactivate.isPending;

  useEffect(() => {
    if (visible && site.data) {
      setName(site.data.name);
      setFeeText(String(num(site.data.monthly_fee)));
      setNameError('');
      setFeeError('');
      mutation.reset();
      deactivate.reset();
      reactivate.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, site.data?.id]);

  function handleClose() {
    if (busy) return;
    onClose();
  }

  function handleSave() {
    if (!site.data) return;
    const trimmedName = name.trim();
    const newFee = parseAmount(feeText);
    let hasError = false;

    if (!trimmedName) {
      setNameError('Site/apartman adı girilmeli.');
      hasError = true;
    } else {
      setNameError('');
    }

    if (newFee <= 0) {
      setFeeError('Aylık sabit ücret sıfırdan büyük olmalı.');
      hasError = true;
    } else {
      setFeeError('');
    }

    if (hasError) return;

    const previousName = site.data.name;
    const previousFee = num(site.data.monthly_fee);

    if (trimmedName === previousName && newFee === previousFee) {
      onClose();
      return;
    }

    mutation.mutate(
      { siteId: site.data.id, module, name: trimmedName, previousName, newFee, previousFee, effectivePeriod: period },
      { onSuccess: () => onSuccess(`${trimmedName} güncellendi.`) },
    );
  }

  function handleDeactivate() {
    if (!site.data) return;
    deactivate.mutate(
      { siteId: site.data.id, module, effectivePeriod: effectiveTerminationPeriod },
      {
        onSuccess: () => {
          setConfirmDeactivateOpen(false);
          onSuccess(`${site.data!.name} için sözleşme ${periodLabel(effectiveTerminationPeriod)} itibarıyla feshedildi.`);
        },
      },
    );
  }

  function handleReactivate() {
    if (!site.data) return;
    reactivate.mutate(
      { siteId: site.data.id, module },
      { onSuccess: () => onSuccess(`${site.data!.name} yeniden aktifleştirildi.`) },
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
              padding: spacing.lg, gap: 2,
              borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
            }}>
              <Txt variant="h3">Site Bilgilerini Düzenle</Txt>
              {!!site.data && (
                <Txt variant="small" color={c.textMuted} numberOfLines={1}>{site.data.name}</Txt>
              )}
            </View>

            {site.isLoading ? (
              <Loading label="Site bilgileri yükleniyor…" />
            ) : site.isError || !site.data ? (
              <View style={{ padding: spacing.lg }}>
                <Txt variant="small" color={c.danger}>Site bilgileri yüklenemedi.</Txt>
              </View>
            ) : (
              <>
                <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
                  {!site.data.is_active && (
                    <View style={{
                      backgroundColor: c.surfaceAlt, borderRadius: radius.md, padding: spacing.md, gap: 2,
                      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
                    }}>
                      <Txt variant="small" color={c.textMuted} style={{ fontWeight: '700' }}>Bu site pasif (sözleşme feshedilmiş)</Txt>
                      <Txt variant="tiny" color={c.textFaint}>Geçmiş bilanço kayıtları korunuyor; yeni dönem açılmıyor.</Txt>
                    </View>
                  )}

                  <Field
                    label="Sitenin / Apartmanın Adı"
                    value={name}
                    onChangeText={setName}
                    error={nameError}
                    autoCapitalize="words"
                  />

                  <Field
                    label="Aylık Sabit Ücret (₺)"
                    placeholder="0"
                    keyboardType="decimal-pad"
                    value={feeText}
                    onChangeText={setFeeText}
                    error={feeError}
                    hint={`Bu ücret ${periodLabel(period)} ve sonraki aylara uygulanır; geçmiş ayların bilançosu değişmez.`}
                  />

                  {mutation.isError && (
                    <Txt variant="small" color={c.danger}>{(mutation.error as Error).message}</Txt>
                  )}

                  <View style={{
                    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border,
                    paddingTop: spacing.lg, gap: spacing.sm,
                  }}>
                    {site.data.is_active ? (
                      <>
                        <Txt variant="small" color={c.textMuted} style={{ fontWeight: '700' }}>Tehlikeli Bölge</Txt>
                        <Txt variant="tiny" color={c.textFaint}>
                          Sözleşme feshedilirse {periodLabel(effectiveTerminationPeriod)} itibarıyla yeni dönem açılmaz.
                          Geçmiş tüm aylar ve borç kayıtları kesinlikle korunur, silinmez.
                        </Txt>
                        <Button
                          title="Sözleşmeyi Feshet / Pasife Al"
                          variant="danger"
                          onPress={() => setConfirmDeactivateOpen(true)}
                          disabled={busy}
                        />
                      </>
                    ) : (
                      <>
                        <Txt variant="tiny" color={c.textFaint}>
                          Müşteri geri döndüyse sözleşmeyi bugünden itibaren yeniden aktifleştirebilirsiniz.
                        </Txt>
                        <Button
                          title="Sözleşmeyi Yeniden Aktifleştir"
                          variant="secondary"
                          onPress={handleReactivate}
                          loading={reactivate.isPending}
                          disabled={busy}
                        />
                      </>
                    )}
                    {deactivate.isError && (
                      <Txt variant="small" color={c.danger}>{(deactivate.error as Error).message}</Txt>
                    )}
                    {reactivate.isError && (
                      <Txt variant="small" color={c.danger}>{(reactivate.error as Error).message}</Txt>
                    )}
                  </View>
                </ScrollView>

                <View style={{
                  flexDirection: 'row', gap: spacing.md, padding: spacing.lg,
                  borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border,
                }}>
                  <Button title="Vazgeç" variant="secondary" onPress={handleClose}
                          disabled={busy} style={{ flex: 1 }} />
                  <Button title="Kaydet" onPress={handleSave}
                          loading={mutation.isPending} disabled={busy && !mutation.isPending} style={{ flex: 1 }} />
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>

      {!!site.data && (
        <ConfirmModal
          visible={confirmDeactivateOpen}
          title="Sözleşme feshedilsin mi?"
          message={`${site.data.name} için sözleşmeyi feshetmek üzeresiniz. ${periodLabel(effectiveTerminationPeriod)} itibarıyla yeni dönem açılmayacak. Geçmiş aylardaki tüm bilanço ve hareket kayıtları KESİNLİKLE korunacak. Bu işlemi onaylıyor musunuz?`}
          confirmLabel="Evet, Feshet"
          danger
          loading={deactivate.isPending}
          onConfirm={handleDeactivate}
          onCancel={() => setConfirmDeactivateOpen(false)}
        />
      )}
    </Modal>
  );
}
