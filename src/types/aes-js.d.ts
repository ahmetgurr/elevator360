/**
 * aes-js resmi TypeScript tipleri yayinlamiyor (npm'de @types/aes-js yok).
 * Sadece secureStorage.ts icinde kullanilan yuzeyi bildiren minimal bir
 * ambient bildirim — kutuphanenin tamamini kapsamaz.
 */
declare module 'aes-js' {
  export namespace utils {
    namespace utf8 {
      function toBytes(text: string): Uint8Array;
      function fromBytes(bytes: Uint8Array): string;
    }
    namespace hex {
      function toBytes(hex: string): Uint8Array;
      function fromBytes(bytes: Uint8Array): string;
    }
  }

  export class Counter {
    constructor(initialValue: number);
  }

  export namespace ModeOfOperation {
    class ctr {
      constructor(key: Uint8Array, counter: Counter);
      encrypt(bytes: Uint8Array): Uint8Array;
      decrypt(bytes: Uint8Array): Uint8Array;
    }
  }
}
