import { coreFetch } from './core';

export type PublicTeam = {
  team: string;
  path: string;
  displayName: { tr: string; en?: string };
};

export const teamsApi = {
  list: () => coreFetch<PublicTeam[]>('/v1/teams'),
};
