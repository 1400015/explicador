package com.tutoria.estudos;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;

/** Nunca guarda a chave Gemini nem a chave AES em texto no sistema de ficheiros. */
public final class SecretVault {
    private static final String ALIAS = "com.tutoria.estudos.gemini.v1";
    private static final byte[] AAD = ALIAS.getBytes(StandardCharsets.UTF_8);
    private final SharedPreferences storage;

    public SecretVault(Context context) {
        storage = context.getSharedPreferences("tutor-vault", Context.MODE_PRIVATE);
    }

    private SecretKey key(boolean create) throws Exception {
        KeyStore keys = KeyStore.getInstance("AndroidKeyStore");
        keys.load(null);
        if (keys.containsAlias(ALIAS)) return ((KeyStore.SecretKeyEntry) keys.getEntry(ALIAS, null)).getSecretKey();
        if (!create) throw new GeneralSecurityException("Chave do dispositivo indisponível");
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setKeySize(256).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true).build());
        return generator.generateKey();
    }

    public synchronized String get() throws Exception {
        synchronized (SecretVault.class) {
        String saved = storage.getString("gemini", null);
        if (saved == null) return null;
        JSONObject json = new JSONObject(saved);
        if (json.getInt("version") != 1) throw new GeneralSecurityException("Formato de segredo inválido");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key(false), new GCMParameterSpec(128, Base64.decode(json.getString("iv"), Base64.NO_WRAP)));
        cipher.updateAAD(AAD);
        return new String(cipher.doFinal(Base64.decode(json.getString("data"), Base64.NO_WRAP)), StandardCharsets.UTF_8);

        }
    }

    public synchronized void set(String value) throws Exception {
        synchronized (SecretVault.class) {
        if (value == null || value.isEmpty() || value.length() > 1000) throw new IllegalArgumentException("Segredo inválido");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key(true));
        cipher.updateAAD(AAD);
        JSONObject json = new JSONObject();
        json.put("version", 1);
        json.put("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP));
        json.put("data", Base64.encodeToString(cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP));
        if (!storage.edit().putString("gemini", json.toString()).commit()) throw new GeneralSecurityException("Falha na gravação");
        if (!value.equals(get())) throw new GeneralSecurityException("Falha na confirmação");

        }
    }

    public synchronized void remove() throws Exception {
        synchronized (SecretVault.class) {
        if (!storage.edit().remove("gemini").commit()) throw new GeneralSecurityException("Falha na remoção");
        KeyStore keys = KeyStore.getInstance("AndroidKeyStore");
        keys.load(null);
        if (keys.containsAlias(ALIAS)) keys.deleteEntry(ALIAS);

        }
    }
}
