// Only the parts of qz-tray this app uses - the package ships no types of its
// own, and the community @types package tracks an older version.
declare module "qz-tray" {
  const qz: {
    security: {
      setSignatureAlgorithm(algorithm: "SHA512"): void;
      setCertificatePromise(
        handler: (resolve: (certificate: string | null) => void, reject: (error: unknown) => void) => void,
      ): void;
      setSignaturePromise(
        factory: (
          request: string,
        ) => (resolve: (signature: string) => void, reject: (error: unknown) => void) => void,
      ): void;
    };
    websocket: {
      isActive(): boolean;
      connect(): Promise<void>;
    };
    printers: {
      find(query: string): Promise<string>;
    };
    configs: {
      create(printer: string): unknown;
    };
    print(
      config: unknown,
      data: { type: "raw"; format: "command"; flavor: "plain"; data: string }[],
    ): Promise<void>;
  };
  export default qz;
}
