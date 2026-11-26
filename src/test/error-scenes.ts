import {
  ERROR_SCENE_VARIANTS,
  errorSceneText,
  type ErrorSceneKind,
} from '@skylab-kulubu/skylcn-ui';

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Any of a kind's titles: each visit draws one of the kind's drawings, with its own words. */
export function sceneTitle(kind: ErrorSceneKind): RegExp {
  const titles = ERROR_SCENE_VARIANTS[kind].map(
    (variant) => errorSceneText(kind, 'tr', variant).title,
  );
  return new RegExp(`^(${titles.map(escape).join('|')})$`);
}

/** The kind's button label, the same in each of its drawings ("Ana sayfaya dön", "Yeniden dene"). */
export function sceneAction(kind: ErrorSceneKind): string {
  return errorSceneText(kind, 'tr', ERROR_SCENE_VARIANTS[kind][0]).action;
}
