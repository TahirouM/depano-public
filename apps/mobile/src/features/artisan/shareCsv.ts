import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';

/** Écrit un CSV dans le cache puis ouvre la feuille de partage (Mail, Fichiers, Drive…). */
export async function shareCsv(filename: string, csv: string): Promise<void> {
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  // BOM UTF-8 : Excel ouvre correctement les accents.
  await file.write(`﻿${csv}`);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/csv',
      UTI: 'public.comma-separated-values-text',
      dialogTitle: 'Exporter mes revenus',
    });
  } else {
    await Share.share({ title: filename, message: csv });
  }
}
