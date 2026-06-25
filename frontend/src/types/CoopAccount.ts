export interface CooperativeAccount {
  id: string;
  name: string;
  members: string[]; // List of member IDs
  sharedPolicies: string[];
}
