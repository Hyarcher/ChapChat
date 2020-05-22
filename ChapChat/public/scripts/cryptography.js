const newNonce = () => nacl.randomBytes(nacl.box.nonceLength);
const generateKeyPair = () => nacl.box.keyPair();

const encrypt = (secretOrSharedKey, json, key) => {
    const nonce = newNonce();
    const messageUint8 = nacl.util.decodeUTF8(JSON.stringify(json));
    const encrypted = key
        ? nacl.box(messageUint8, nonce, key, secretOrSharedKey)
        : nacl.box.after(messageUint8, nonce, secretOrSharedKey);

    const fullMessage = new Uint8Array(nonce.length + encrypted.length);
    fullMessage.set(nonce);
    fullMessage.set(encrypted, nonce.length);

    const base64FullMessage = nacl.util.encodeBase64(fullMessage);
    return base64FullMessage;
};

const decrypt = (secretOrSharedKey, messageWithNonce, key) => {
    const messageWithNonceAsUint8Array = nacl.util.decodeBase64(messageWithNonce);
    const nonce = messageWithNonceAsUint8Array.slice(0, nacl.box.nonceLength);
    const message = messageWithNonceAsUint8Array.slice(
        nacl.box.nonceLength,
        messageWithNonce.length
    );

    const decrypted = key
        ? nacl.box.open(message, nonce, key, secretOrSharedKey)
        : nacl.box.open.after(message, nonce, secretOrSharedKey);

    if (!decrypted) {
        throw new Error('Could not decrypt message');
    }

    const base64DecryptedMessage = nacl.util.encodeUTF8(decrypted);
    return JSON.parse(base64DecryptedMessage);
};
