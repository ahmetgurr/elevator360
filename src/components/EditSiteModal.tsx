import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, View,
} from 'react-native';
import { useTheme } from '@/lib/theme';
import { useSite, useUpdateSiteDetails } from '@/lib/api';
import { num, parseAmount, periodLabel } from '@/lib/format';
import type { ModuleType } from '@/lib/types';
import { Button, Field, Loading, Txt } from './ui';

/**
 * Site adi / aylik sabit ucret duzenleme formu. Ucret degisikligi SADECE
 * `period` ve sonrasini etkiler; gecmis aylarin bilancosu bozulmaz
 * (bkz. useUpdateSiteDetails / set_site_fee).
 */
export function EditSiteModal({ visible, siteId, module, period, onClose, onSuccess }: {
  visible: boolean;
  siteId: string | undefined;
  module: ModuleType;
  /** Zam uygulanacaksa etkinlik tarihi: su an listede goruntulenen donem */
  period: string;
  onClose: () => void;
  onSuccess: (name: string) => void;
}) {
  const { c, spacing, radius } = useTheme();
  const site = useSite(visible ? siteId : undefined);
  const mutation = useUpdateSiteDetails();

  const [name, setName] = useState('');
  const [feeText, setFeeText] = useState('');
  const [nameError, setNameError] = useState('');
  const [feeError, setFeeError] = useState('');

  useEffect(() => {
    if (visible && site.data) {
      setName(site.data.name);
      setFeeText(String(num(site.data.monthly_fee)));
      setNameError('');
      setFeeError('');
      mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, site.data?.id]);

  function handleClose() {
    if (mutation.isPending) return;
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
      { onSuccess: () => onSuccess(trimmedName) },
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
            ) : site.isError ? (
              <View style={{ padding: spacing.lg }}>
                <Txt variant="small" color={c.danger}>Site bilgileri yüklenemedi.</Txt>
              </View>
            ) : (
              <>
                <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
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
              </>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
