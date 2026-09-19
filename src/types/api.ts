export interface UserDto {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  name?: string;
  surname?: string;
  skyNumber?: string;
  phoneNumber?: string;
  profilePictureUrl?: string;
  linkedin?: string;
  university?: string;
  faculty?: string;
  department?: string;
  studentCardUid?: string;
  roles: string[];
  groups?: string[];
  ldapUser?: boolean;
}
