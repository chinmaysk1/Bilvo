export interface UserMeResponse {
  id: string;
  name: string | null;
  email: string | null;
  householdId: string | null;
  autopayEnabled: boolean | null;
}
