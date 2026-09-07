import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { glassColors, useTheme } from '@/lib/theme';
import { useCreateSite } from '@/lib/api';
import { currentPeriod, parseAmount, periodLabel } from '@/lib/format';
import { MODULE_LABEL, type ModuleType } from '@/lib/types';
import { PeriodSwitcher } from './pickers';
import { Button, Field, ModalShell, Txt } from './ui';
import { bounceScrollProps } from './Glass';

/**
 * Yeni site/apartman ekleme formu. Modul tipi ekrandan miras alinir
 * (kullanici hangi modul listesindeyse yeni site o module acilir) —
 * ayrica secilebilir bir alan degildir, boylece site yanlislikla
 * baska bir listede goruntulenemez hale gelmez.
 */
export function AddSiteModal({ visible, module, onClose, onSuccess }: {
  visible: boolean;
  module: ModuleType;
  onClose: () => void;
  onSuccess: (site: { id: string; name: string }) => void;
}) {
  const { c, spacing, radius } = useTheme();
  const mutation = useCreateSite();

  const [name, setName] = useState('');
  const [feeText, setFeeText] = useState('');
  const [notesText, setNotesText] = useState('');
  const [startPeriod, setStartPeriod] = useState(currentPeriod());
  const [nameError, setNameError] = useState('');
  const [feeError, setFeeError] = useState('');

  useEffect(() => {
    if (visible) {
      setName('');
      setFeeText('');
      setNotesText('');
      setStartPeriod(currentPeriod());
      setNameError('');
      setFeeError('');
      mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function handleClose() {
    if (mutation.isPending) return;
    onClose();
  }

  function handleSave() {
    const trimmedName = name.trim();
    const fee = parseAmount(feeText);
    let hasError = false;

    if (!trimmedName) {
      setNameError('Site/apartman adı girilmeli.');
      hasError = true;
    } else {
      setNameError('');
    }

    if (fee <= 0) {
      setFeeError('Aylık sabit ücret sıfırdan büyük olmalı.');
      hasError = true;
    } else {
      setFeeError('');
    }

    if (hasError) return;

    mutation.mutate(
      { module, name: trimmedName, monthlyFee: fee, startPeriod, notes: notesText.trim() || null },
      { onSuccess: site => onSuccess({ id: site.id, name: site.name }) },
    );
  }

  return (
    <ModalShell visible={visible} onClose={handleClose} keyboardAvoiding maxHeightRatio={0.88}>
            <View style={{
              padding: spacing.lg, gap: 2, flexShrink: 0,
              borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: glassColors.cardBorder,
            }}>
              <Txt variant="h3">Yeni Site / Apartman Ekle</Txt>
              <Txt variant="small" color={c.textMuted}>{MODULE_LABEL[module]} listesine eklenecek</Txt>
            </View>

            <ScrollView
              style={{ flexShrink: 1 }}
              contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
              keyboardShouldPersistTaps="handled"
              {...bounceScrollProps}
            >
              <Field
                label="Sitenin / Apartmanın Adı"
                placeholder="Örn: Yeşil Vadi Sitesi"
                value={name}
                onChangeText={setName}
                error={nameError}
                autoCapitalize="words"
                maxLength={200}
              />

              <View style={{
                backgroundColor: 'transparent',
                borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)',
                paddingTop: spacing.md, gap: 2,
              }}>
                <Txt variant="small" color={c.textMuted} style={{ fontWeight: '600' }}>Modül Tipi</Txt>
                <Txt variant="body" color={c.text}>{MODULE_LABEL[module]}</Txt>
              </View>

              <Field
                label="Aylık Sabit Ücret (₺)"
                placeholder="0"
                keyboardType="decimal-pad"
                value={feeText}
                onChangeText={setFeeText}
                error={feeError}
                maxLength={15}
              />

              <View style={{ gap: spacing.xs }}>
                <Txt variant="small" color={c.textMuted} style={{ fontWeight: '600' }}>Başlangıç Ayı</Txt>
                <PeriodSwitcher period={startPeriod} onChange={setStartPeriod} />
                <Txt variant="tiny" color={c.textFaint}>
                  Site, {periodLabel(startPeriod)} döneminden itibaren borçlandırılmaya başlanır.
                </Txt>
              </View>

              <Field
                label="Not / Yorum (opsiyonel)"
                placeholder="Bu siteye dair özel bir durum varsa buraya yazın"
                value={notesText}
                onChangeText={setNotesText}
                multiline
                numberOfLines={3}
                maxLength={4000}
                style={{ minHeight: 76, textAlignVertical: 'top' }}
              />

              {mutation.isError && (
                <Txt variant="small" color={c.danger}>{(mutation.error as Error).message}</Txt>
              )}
            </ScrollView>

            <View style={{
              flexDirection: 'row', gap: spacing.md, padding: spacing.lg, flexShrink: 0,
              borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: glassColors.cardBorder,
            }}>
              <Button title="Vazgeç" variant="secondary" onPress={handleClose}
                      disabled={mutation.isPending} style={{ flex: 1 }} />
              <Button title="Kaydet" onPress={handleSave}
                      loading={mutation.isPending} style={{ flex: 1 }} />
            </View>
    </ModalShell>
  );
}
