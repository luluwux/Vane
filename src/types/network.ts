/**
 * Rust tarafındaki `NetworkAdapter` struct'ıyla birebir eşleşir.
 * `#[serde(rename_all = "camelCase")]` nedeniyle tüm alanlar camelCase.
 */
export interface NetworkAdapter {
  name: string;
  currentPrimaryDns: string | null;
  currentSecondaryDns: string | null;
  isDhcp: boolean;
}
