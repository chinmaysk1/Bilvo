export interface HouseholdSummary {
  id: string;
  name: string;
  address: string;
  isAdmin: boolean;
}

export interface Household {
  id: string;
  name: string;
  address: string;
  members: Array<{
    id: string;
    name: string;
    email: string;
  }>;
  inviteCode?: string;
}

export interface HouseholdApiMember {
  id: string;
  name: string | null;
  email: string | null;
}

export interface HouseholdApiResponse {
  household: {
    id: string;
    name: string;
    address: string;
    createdAt: string;
    adminId: string;
    members: HouseholdApiMember[];
    inviteCode: string;
  };
  currentUserId: string;
}

// Member specific interfaces
export interface Member {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone?: string;
  role: "Admin" | "Member";
  color: string;
  autopay: boolean;
  moveInDate: Date | null;
  moveOutDate: Date | null;
  hasAccount: boolean;
}

export interface MemberSplit {
  memberId: string;
  value: number;
  included: boolean;
}
