package com.tutoria.estudos;

import static org.junit.Assert.*;
import android.content.Context;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class SecretVaultTest {
    private Context context;
    private SecretVault vault;
    private static final String SECRET = "AIzaDUMMY_ONLY_FOR_ANDROID_TESTING_12345";
    @Before public void before() throws Exception {
        context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        vault = new SecretVault(context);
        vault.remove();
    }
    @After public void after() throws Exception { vault.remove(); }

    @Test public void encryptsAtRestAndReadsAfterRecreation() throws Exception {
        vault.set(SECRET);
        assertEquals(SECRET, new SecretVault(context).get());
        String cipher = context.getSharedPreferences("tutor-vault",0).getString("gemini","");
        assertFalse(cipher.contains(SECRET));
        assertTrue(cipher.contains("\"version\":1"));
    }
    @Test public void randomizedEncryptionAndRemoval() throws Exception {
        vault.set(SECRET);
        String first = context.getSharedPreferences("tutor-vault",0).getString("gemini","");
        vault.set(SECRET);
        assertNotEquals(first, context.getSharedPreferences("tutor-vault",0).getString("gemini",""));
        vault.remove();
        assertNull(new SecretVault(context).get());
    }
    @Test public void tamperedCipherIsNotReturnedAsPlaintext() throws Exception {
        vault.set(SECRET);
        context.getSharedPreferences("tutor-vault",0).edit().putString("gemini","{\"version\":1,\"iv\":\"AAAA\",\"data\":\"AAAA\"}").commit();
        try { vault.get(); fail("Tampering must be rejected"); } catch (Exception expected) {}
    }
    @Test public void committedStateAndLegacyCleanup() throws Exception {
        SecurityState state = new SecurityState(context);
        context.getSharedPreferences("CapacitorStorage",0).edit().putString("tutor-ia-settings-v1","legacy secret").commit();
        state.set("settings","{\"version\":2,\"pin\":null}");
        assertEquals("{\"version\":2,\"pin\":null}", new SecurityState(context).get("settings"));
        state.removeLegacy();
        assertFalse(context.getSharedPreferences("CapacitorStorage",0).contains("tutor-ia-settings-v1"));
        try { state.set("settings","{\"apiKey\":\"secret\"}"); fail("Secrets must use the vault"); } catch (IllegalArgumentException expected) {}
    }
}
