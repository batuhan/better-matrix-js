export type MatrixCryptoBootstrapResult = {
  success: boolean;
  error?: string;
};

export class MatrixCryptoBootstrapper<TEvent = unknown> {
  async bootstrap(): Promise<MatrixCryptoBootstrapResult> {
    return { success: true };
  }
}
