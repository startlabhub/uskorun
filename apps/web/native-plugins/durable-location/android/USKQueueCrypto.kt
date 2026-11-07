// USKORUN MIT owned GPS-at-rest encryption. No paid dependencies.
// Each fix is AES-256/GCM with a fresh Keystore-generated IV and 128-bit tag.
// Keystore key is not user-auth-bound: locked-screen background writes must work.
// Do NOT enable setUserAuthenticationRequired or biometric invalidation.
package com.uskorun.app

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

internal class USKQueueCrypto {
    companion object {
        private const val ALIAS="uskorun_gps_queue_aes_v1"
        private const val PROVIDER="AndroidKeyStore"
        const val PREFIX="gcm1:"
        private const val TRANSFORM="AES/GCM/NoPadding"
        private const val IV_BYTES=12
    }
    private fun key():SecretKey {
        val store=KeyStore.getInstance(PROVIDER)
        store.load(null)
        val existing=store.getKey(ALIAS,null)
        if(existing is SecretKey)return existing
        // Missing key (e.g. backup/restoration) generates a new one.
        // Existing ciphertext will be quarantined if it cannot authenticate.
        val generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,PROVIDER)
        val spec=KeyGenParameterSpec.Builder(ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setKeySize(256)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true)
            .setUserAuthenticationRequired(false)
            // No setInvalidatedByBiometricEnrollment call: non-auth keys
            // are not bound to biometric/lock-screen enrollment.
            .build()
        generator.init(spec)
        return generator.generateKey()
    }
    fun seal(plain:ByteArray):String{
        val cipher=Cipher.getInstance(TRANSFORM)
        cipher.init(Cipher.ENCRYPT_MODE,key())
        val iv=cipher.iv
        check(iv.size==IV_BYTES){"Unexpected Android GCM IV length"}
        // Contains authentication tag; nothing is written before doFinal.
        val ciphertext=cipher.doFinal(plain)
        val combined=iv+ciphertext
        return PREFIX+Base64.encodeToString(combined,Base64.NO_WRAP)
    }
    fun open(line:String):ByteArray{
        require(line.startsWith(PREFIX)){"Unrecognized encrypted GPS record"}
        val body=Base64.decode(line.substring(PREFIX.length),Base64.NO_WRAP)
        require(body.size>=IV_BYTES+16){"Truncated AES-GCM record"}
        val iv=body.copyOfRange(0,IV_BYTES)
        val ciphertext=body.copyOfRange(IV_BYTES,body.size)
        val cipher=Cipher.getInstance(TRANSFORM)
        cipher.init(Cipher.DECRYPT_MODE,key(),GCMParameterSpec(128,iv))
        return cipher.doFinal(ciphertext) // validates tag; never return unauthenticated GPS
    }
}
