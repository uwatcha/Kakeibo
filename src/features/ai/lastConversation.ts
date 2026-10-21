import AsyncStorage from '@react-native-async-storage/async-storage';

// AI 相談を開き直したとき（アプリを起動し直したときなど）に、最後に開いていた会話を出すため。端末ごとの便利機能なので AsyncStorage に置く
const STORAGE_KEY = 'kakeibo:lastAiConversation';

export async function loadLastConversation(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function saveLastConversation(id: string | null): Promise<void> {
  try {
    if (id) await AsyncStorage.setItem(STORAGE_KEY, id);
    else await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // 保存できなくても会話には影響しない
  }
}
