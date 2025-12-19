export interface Activity {
  id: string;
  type: string;
  description: string;
  amount?: number;
  timestamp: string;
  detail?: string;
  source?: string;
}
