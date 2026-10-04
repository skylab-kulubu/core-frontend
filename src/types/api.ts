import type { ProfilePicture } from '@/lib/profile-picture';

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
  profilePictureSizes?: ProfilePicture['profilePictureSizes'];
  linkedin?: string;
  university?: string;
  faculty?: string;
  department?: string;
  studentCardUid?: string;
  roles: string[];
  groups?: string[];
  ldapUser?: boolean;
}
