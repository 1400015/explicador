package com.tutoria.estudos;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;

@CapacitorPlugin(name = "SecureSettings")
public class SecureSettingsPlugin extends Plugin {
    private SecretVault vault;
    private SecurityState state;
    @Override public void load() { vault = new SecretVault(getContext()); state = new SecurityState(getContext()); }

    @PluginMethod public void get(PluginCall call) {
        try { JSObject result = new JSObject(); String value = vault.get(); result.put("value", value == null ? JSONObject.NULL : value); call.resolve(result); }
        catch (Exception error) { call.reject("Não foi possível abrir a chave protegida. Apaga a chave e configura-a novamente.", "SECRET_UNAVAILABLE"); }
    }
    @PluginMethod public void set(PluginCall call) {
        try { vault.set(call.getString("value")); call.resolve(); }
        catch (Exception error) { call.reject("Não foi possível guardar a chave protegida. Tenta novamente.", "SECRET_WRITE_FAILED"); }
    }
    @PluginMethod public void remove(PluginCall call) {
        try { vault.remove(); call.resolve(); }
        catch (Exception error) { call.reject("Não foi possível apagar a chave protegida. Tenta novamente.", "SECRET_REMOVE_FAILED"); }
    }
    @PluginMethod public void readState(PluginCall call) {
        try { JSObject result = new JSObject(); String value = state.get(call.getString("key")); result.put("value", value == null ? JSONObject.NULL : value); call.resolve(result); }
        catch (Exception error) { call.reject("Não foi possível ler a proteção guardada.", "STATE_READ_FAILED"); }
    }
    @PluginMethod public void writeState(PluginCall call) {
        try { state.set(call.getString("key"), call.getString("value")); call.resolve(); }
        catch (Exception error) { call.reject("Não foi possível confirmar a gravação das definições.", "STATE_WRITE_FAILED"); }
    }
    @PluginMethod public void removeLegacy(PluginCall call) {
        try { state.removeLegacy(); call.resolve(); }
        catch (Exception error) { call.reject("Não foi possível remover a cópia antiga. Tenta novamente.", "LEGACY_REMOVE_FAILED"); }
    }
}
