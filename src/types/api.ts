// API Response Wrapper Types
export interface DataResult<T> {
  success: boolean;
  message: string;
  httpStatus: string;
  path: string;
  timeStamp: string;
  data: T;
}

export interface DataResultList<T> {
  success: boolean;
  message: string;
  httpStatus: string;
  path: string;
  timeStamp: string;
  data: T[];
}

export interface Result {
  success: boolean;
  message: string;
  httpStatus: string;
  path: string;
  timeStamp: string;
}

export interface SuccessResult extends Result {}

export interface DataResultVoid {
  success: boolean;
  message: string;
  httpStatus: string;
  path: string;
  timeStamp: string;
  data: object;
}

// Entity Types

// User
export interface UserDto {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  name?: string; // Some endpoints might use name/surname
  surname?: string;
  skyNumber?: string;
  phoneNumber?: string;
  profilePictureUrl?: string;
  linkedin?: string;
  university?: string;
  faculty?: string;
  department?: string;
  roles: string[];
  groups?: string[];
  ldapUser?: boolean;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  name?: string;
  surname?: string;
  phoneNumber?: string;
  linkedin?: string;
  studentNumber?: string;
  skyNumber?: string;
  university?: string;
  faculty?: string;
  department?: string;
}

export interface CreateUserRequest {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

// EventType
export interface EventTypeDto {
  id: string;
  name: string;
  authorizedRoles?: string[];
}

export interface CreateEventTypeRequest {
  name: string;
  authorizedRoles?: string[];
}

export interface UpdateEventTypeRequest {
  name?: string;
  authorizedRoles?: string[];
}

// Competitor
export interface CompetitorDto {
  id: string;
  user?: UserDto;
  event?: EventDto;
  /** API bazı uçlarda skor olarak döner */
  score?: number;
  /** Bazı uçlarda puan olarak döner */
  points?: number;
  rank?: number;
  winner?: boolean;
}

export interface CreateCompetitorRequest {
  userId?: string;
  eventId?: string;
  points?: number;
  winner?: boolean;
}

export interface UpdateCompetitorRequest {
  userId?: string;
  eventId?: string;
  points?: number;
  winner?: boolean;
}

// Event
export interface EventDto {
  id: string;
  name: string;
  coverImageUrl?: string;
  description?: string;
  location?: string;
  type?: EventTypeDto;
  formUrl?: string;
  startDate?: string;
  endDate?: string;
  linkedin?: string;
  active?: boolean;
  prizeInfo?: string;
  season?: SeasonDto;
  sessions?: SessionDto[];
  imageUrls?: string[];
  competitors?: CompetitorDto[];
  ranked?: boolean;
  competition?: CompetitionDto;
}

export interface GetEventDayResponseDto {
  id: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  event?: EventDto;
}

export interface CreateEventDayRequest {
  eventId?: string;
  name?: string;
  startDate?: string;
  endDate?: string;
}

export interface UpdateEventDayRequest {
  startDate?: string;
  endDate?: string;
}

export interface CreateEventRequest {
  name?: string;
  description?: string;
  location?: string;
  eventTypeId?: string;
  seasonId?: string;
  capacity?: number;
  formUrl?: string;
  startDate?: string;
  endDate?: string;
  linkedin?: string;
  active?: boolean;
  competitionId?: string;
  prizeInfo?: string;
  isRanked?: boolean;
  ranked?: boolean;
}

export interface CompetitionDto {
  id: string;
  name: string;
}

export interface UpdateEventRequest {
  name?: string;
  description?: string;
  location?: string;
  type?: string;
  formUrl?: string;
  prizeInfo?: string;
  startDate?: string;
  typeId?: string;
  seasonId?: string;
  endDate?: string;
  linkedin?: string;
  active?: boolean;
  competitionId?: string;
  ranked?: boolean;
}

// Season
export interface SeasonDto {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  active?: boolean;
  events?: EventDto[];
}

export interface CreateSeasonRequest {
  name?: string;
  startDate?: string;
  endDate?: string;
  active?: boolean;
}

export interface UpdateSeasonRequest {
  name?: string;
  startDate?: string;
  endDate?: string;
  active?: boolean;
}

// Session
export interface SessionDto {
  id: string;
  title: string;
  speakerName?: string;
  speakerLinkedin?: string;
  speakerImageUrl?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  orderIndex?: number;
  eventDayId?: string;
  event?: EventDto;
  sessionType?: string;
  // Enum values are: WORKSHOP, PRESENTATION, PANEL, KEYNOTE, NETWORKING, OTHER, CTF, HACKATHON, JAM
}

export interface CreateSessionRequest {
  eventDayId?: string;
  title?: string;
  speakerName?: string;
  speakerImageId?: string;
  speakerLinkedin?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  orderIndex?: number;
  sessionType?: string;
}

export interface UpdateSessionRequest {
  title?: string;
  speakerName?: string;
  speakerLinkedin?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  orderIndex?: number;
  sessionType?: string;
}

// Announcement
export interface AnnouncementDto {
  id: string;
  title: string;
  body: string;
  active?: boolean;
  eventType?: EventTypeDto;
  formUrl?: string;
  coverImageUrl?: string;
}

export interface CreateAnnouncementRequestDto {
  title: string;
  body: string;
  active?: boolean;
  eventTypeId?: string;
  formUrl?: string;
}

export interface UpdateAnnouncementRequest {
  title?: string;
  body?: string;
  active?: boolean;
  eventTypeId?: string;
  formUrl?: string;
}

// Media
export interface MediaDto {
  id: string;
  name: string;
  type: string;
  url: string;
  size?: number;
}

// Promote User
export interface PromoteUserRequest {
  targetRole: string;
  initialPassword: string;
}

// Leaderboard
export interface LeaderboardDto {
  user?: UserDto;
  totalScore?: number;
  eventCount?: number;
  rank?: number;
}

// Auth / Internal
export interface RegisterRequestDto {
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
}

export interface RegisterResponseDto {
  ldapSkyNumber?: string;
}

// Image
export interface UploadImageResponseDto {
  id: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  fileSize?: number;
}

export interface CreateGroupRequest {
  groupName: string;
}

// Tickets
export interface TicketCheckInDto {
  id: string;
  eventDayId?: string;
  createdAt?: string;
  scannedBy?: UserDto;
}

export interface GetTicketResponseDto {
  id: string;
  sent?: boolean;
  ticketType?: 'REGISTERED' | 'GUEST';
  owner?: UserDto;
  guestFirstName?: string;
  guestLastName?: string;
  guestEmail?: string;
  guestPhoneNumber?: string;
  guestUniversity?: string;
  guestFaculty?: string;
  guestDepartment?: string;
  guestGrade?: string;
  event?: EventDto;
  checkIns?: TicketCheckInDto[];
}

// Response Type Aliases
export type DataResultUserDto = DataResult<UserDto>;
export type DataResultListUserDto = DataResultList<UserDto>;
export type DataResultSetUserDto = DataResult<UserDto[]>; // Special for Set return types if any, usually List

export type DataResultEventTypeDto = DataResult<EventTypeDto>;
export type DataResultListEventTypeDto = DataResultList<EventTypeDto>;

export type DataResultCompetitorDto = DataResult<CompetitorDto>;
export type DataResultListCompetitorDto = DataResultList<CompetitorDto>;

export type DataResultEventDto = DataResult<EventDto>;
export type DataResultListEventDto = DataResultList<EventDto>;

export type DataResultSeasonDto = DataResult<SeasonDto>;
export type DataResultListSeasonDto = DataResultList<SeasonDto>;

export type DataResultSessionDto = DataResult<SessionDto>;
export type DataResultListSessionDto = DataResultList<SessionDto>;

export type DataResultAnnouncementDto = DataResult<AnnouncementDto>;
export type DataResultListAnnouncementDto = DataResultList<AnnouncementDto>;

export type SuccessDataResultUploadImageResponseDto = DataResult<UploadImageResponseDto>;

export type DataResultListLeaderboardDto = DataResultList<LeaderboardDto>;

export type DataResultMediaDto = DataResult<MediaDto>;

export type DataResultListGetTicketResponseDto = DataResultList<GetTicketResponseDto>;
export type DataResultGetTicketResponseDto = DataResult<GetTicketResponseDto>;

export type DataResultGetEventDayResponseDto = DataResult<GetEventDayResponseDto>;
export type DataResultListGetEventDayResponseDto = DataResultList<GetEventDayResponseDto>;
