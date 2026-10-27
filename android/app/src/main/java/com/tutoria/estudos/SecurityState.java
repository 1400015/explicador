package com.tutoria.estudos;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONObject;

/** Metadados não secretos, com commit síncrono e confirmação de leitura. */
public final class SecurityState {
    private final Context context;
    private final SharedPreferences state;
    public SecurityState(Context context) {
        this.context = context;
        state = context.getSharedPreferences("tutor-security", Context.MODE_PRIVATE);
    }
    private void validate(String key) {
        if (!"settings".equals(key) && !"pinAttempts".equals(key)) throw new IllegalArgumentException("Estado inválido");
    }
    public synchronized String get(String key) {
        validate(key);
        return state.getString(key, null);
    }
    public synchronized void set(String key, String value) throws Exception {
        validate(key);
        if (value == null || value.length() > 16000) throw new IllegalArgumentException("Estado inválido");
        JSONObject json = new JSONObject(value);
        if (json.has("apiKey")) throw new IllegalArgumentException("O segredo deve estar no cofre");
        if (!state.edit().putString(key, value).commit() || !value.equals(state.getString(key, null))) throw new IllegalStateException("Falha na confirmação");
    }
    public synchronized void removeLegacy() {
        SharedPreferences legacy = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = legacy.edit().remove("tutor-ia-settings-v1");
        if (state.contains("pinAttempts")) editor.remove("tutor-ia-pin-attempts-v2");
        if (!editor.commit()) throw new IllegalStateException("Falha ao limpar legado");
    }
}
