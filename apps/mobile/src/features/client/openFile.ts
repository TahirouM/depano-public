import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

/** Ouvre un document (facture PDF, URL signée courte) dans le navigateur intégré. */
export async function openDocument(url: string) {
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener');
    return;
  }
  await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
}
