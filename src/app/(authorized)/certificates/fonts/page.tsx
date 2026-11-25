'use client';

import { DataListTitle, MenuItem, cn, type DataListColumn } from '@skylab-kulubu/skylcn-ui';
import { Archive, Check, RefreshCw, TriangleAlert, Upload } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { DataList } from '@/components/chrome/DataList';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { ListPage, RowMenu } from '@/components/chrome/ListPage';
import { ListToolbar } from '@/components/chrome/ListToolbar';
import { Command, CommandBar } from '@/components/chrome/object-page/CommandBar';
import { EmptyState } from '@/components/chrome/PageState';
import { SaveButton } from '@/components/chrome/SaveButton';
import { Select } from '@/components/chrome/Select';
import { SidePanel } from '@/components/chrome/SidePanel';
import { useAuth } from '@/context/AuthContext';
import { certificatesApi, type CertificateFont } from '@/lib/api/certificates';
import { ProblemError } from '@/lib/api/core';
import { mediaApi } from '@/lib/api/media';
import { teamsApi } from '@/lib/api/teams';
import {
  canEditCertificateTemplateForTeam,
  canManageCertificateTemplates,
  isPrivileged,
  ownerLevels,
} from '@/lib/auth/groups';
import { useCapabilities } from '@/lib/capabilities-context';
import {
  FONT_SAMPLE,
  fontFaceLabel,
  missingLettersText,
  useLoadedCertificateFonts,
  userFontName,
} from '@/lib/certificate-user-fonts';
import { coreProblemMessage } from '@/lib/core-problems';
import { matchesQuery } from '@/lib/list-query';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';
import { useConfirm } from '@/lib/ui/use-confirm';
import { useListParams } from '@/lib/ui/use-list-params';
import { useNotify } from '@/lib/ui/use-notify';
import { useAppCan, useTeamCan } from '@/lib/use-app-can';

const FONT_FILE_TYPES = '.ttf,.otf,.woff2,font/ttf,font/otf,font/woff2';

const DAY = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeZone: 'Europe/Istanbul' });

function addedOn(raw: string) {
  const at = new Date(raw);
  return Number.isNaN(at.getTime()) ? '—' : DAY.format(at);
}

const teamLabel = (ownerTeam: string) => ownerTeam || 'Kulüp geneli';

/** A refused upload in a short line; core's `font_exists` names the font already there. */
function uploadProblem(cause: unknown) {
  // pdf-tools checks every font: without it nothing can be added for now
  if (
    cause instanceof ProblemError &&
    cause.status === 503 &&
    (cause.code === 'pdf_tools_unavailable' || cause.code === 'busy' || !cause.code)
  ) {
    return 'Yazı tipi şu an denetlenemiyor; biraz sonra tekrar dene.';
  }
  return coreProblemMessage(cause, 'Yazı tipi yüklenemedi');
}

/**
 * Sertifika yazı tipleri: a team's and the club's uploaded certificate fonts
 * (core docs/certificate-fonts.md). Who may create a team's templates adds and
 * archives its fonts; everyone else who may use them reads the list.
 */
export default function CertificateFontsPage() {
  const { user } = useAuth();
  const groups = useMemo(() => user?.groups ?? [], [user?.groups]);
  const roles = useMemo(() => user?.roles ?? [], [user?.roles]);
  const privileged = isPrivileged(groups);
  const search = useSearchParams();
  // "X yazı tipini yükle" from a text conversion: the PDF's family
  const wantedFamily = search?.get('aile')?.trim() ?? '';
  const [params, setParams] = useListParams();
  const capabilities = useCapabilities();
  const teamCan = useTeamCan();
  const appCan = useAppCan(canManageCertificateTemplates(groups, roles));
  const coreTeamNames =
    capabilities.status === 'ready'
      ? (capabilities.data.teams ?? []).map((row) => row.team).join('\n')
      : '';
  const [teamNames, setTeamNames] = useState<string[]>([]);
  const [team, setTeam] = useState<string | null>(null);
  const [fonts, setFonts] = useState<CertificateFont[] | null>(null);
  const [failed, setFailed] = useState<string>();
  const [uploadOpen, setUploadOpen] = useState(Boolean(wantedFamily));
  const [file, setFile] = useState<File | null>(null);
  const [uploadTeam, setUploadTeam] = useState<string>();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>();
  const notify = useNotify();
  const [confirm, confirmDialog] = useConfirm();

  // The teams the person may read the fonts of: theirs, a Sub-team led from above, every team for YK
  useEffect(() => {
    teamsApi
      .list()
      .then((rows) => setTeamNames(rows.map((row) => row.team)))
      .catch(() => setTeamNames([]));
  }, []);
  const teams = useMemo(() => {
    const coreTeams = coreTeamNames ? coreTeamNames.split('\n') : [];
    return teamNames.filter(
      (ownerTeam) =>
        privileged || ownerLevels(groups, ownerTeam).length > 0 || coreTeams.includes(ownerTeam),
    );
  }, [teamNames, privileged, groups, coreTeamNames]);
  // A YK member starts with the club's; a Leader with their first team
  const shownTeam = team ?? (privileged ? '' : (teams[0] ?? ''));

  const uploadTeams = useMemo(
    () =>
      teams.filter(
        (ownerTeam) =>
          canEditCertificateTemplateForTeam(groups, roles, ownerTeam) &&
          teamCan(ownerTeam, 'certificateTemplate.create'),
      ),
    [teams, groups, roles, teamCan],
  );
  const clubUpload =
    canEditCertificateTemplateForTeam(groups, roles, '') &&
    teamCan('', 'certificateTemplate.create');
  const canUpload = appCan('media.uploadCertificateFont') && (clubUpload || uploadTeams.length > 0);
  const canArchive = (font: CertificateFont) =>
    canUpload && (font.ownerTeam ? uploadTeams.includes(font.ownerTeam) : clubUpload);

  // Each read's number: an answer for a team no longer shown is dropped
  const readId = useRef(0);
  const load = useCallback(() => {
    const id = ++readId.current;
    setFailed(undefined);
    setFonts(null);
    certificatesApi
      .fonts(shownTeam || undefined)
      .then((rows) => {
        if (id === readId.current) setFonts(rows);
      })
      .catch((cause) => {
        if (id !== readId.current) return;
        setFonts([]);
        setFailed(coreProblemMessage(cause, 'Yazı tipleri yüklenemedi'));
      });
  }, [shownTeam]);
  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => fonts ?? [], [fonts]);
  useLoadedCertificateFonts(rows);
  const shown = rows.filter((font) => matchesQuery(params.q, font.family, font.ownerTeam));

  function openUpload() {
    setFile(null);
    setUploadError(undefined);
    setUploadTeam(undefined);
    setUploadOpen(true);
  }
  // Until one is picked: the team shown, else the club's, else the first the person may add to
  const chosenTeam =
    uploadTeam ??
    (shownTeam && uploadTeams.includes(shownTeam) ? shownTeam : clubUpload ? '' : uploadTeams[0]);

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file || chosenTeam === undefined) return;
    setUploading(true);
    setUploadError(undefined);
    try {
      const media = await mediaApi.upload(file, 'certificate_font');
      const font = await certificatesApi.createFont(media.id, chosenTeam);
      notify.success(`${font.family} ${fontFaceLabel(font)} eklendi`);
      setUploadOpen(false);
      if (font.ownerTeam === '' || font.ownerTeam === shownTeam) {
        setFonts((current) => [...(current ?? []), font]);
      }
    } catch (cause) {
      setUploadError(uploadProblem(cause));
      if (cause instanceof ProblemError && cause.code === 'font_exists') {
        const id = typeof cause.fields.fontId === 'string' ? cause.fields.fontId : '';
        const existing = rows.find((font) => font.id === id);
        if (existing) setParams({ q: existing.family });
      }
    } finally {
      setUploading(false);
    }
  }

  function askArchive(font: CertificateFont) {
    confirm({
      title: `${font.family} ${fontFaceLabel(font)} arşivlensin mi?`,
      description: 'Yayınlanmış şablonlar etkilenmez; yeni şablonda seçilemez.',
      actionLabel: 'Arşivle',
      failure: (cause) => coreProblemMessage(cause, 'Arşivlenemedi'),
      onConfirm: async () => {
        await certificatesApi.archiveFont(font.id);
        setFonts((current) => (current ?? []).filter((row) => row.id !== font.id));
        notify.success(`${font.family} arşivlendi`);
      },
    });
  }

  const columns: DataListColumn<CertificateFont>[] = [
    {
      id: 'family',
      width: 'minmax(0,1fr)',
      header: 'Yazı tipi',
      cell: (font) => (
        <DataListTitle
          title={font.family}
          subtitle={
            <span
              data-font-sample
              className="text-secondary-foreground truncate text-sm"
              style={{
                fontFamily: `'${userFontName(font.mediaId)}', sans-serif`,
                fontWeight: font.weight,
                fontStyle: font.style,
              }}
            >
              {FONT_SAMPLE}
            </span>
          }
        />
      ),
    },
    {
      id: 'face',
      width: '6rem',
      from: 'sm',
      header: 'Kalınlık',
      cell: (font) => <span className={TEXT_SECONDARY}>{fontFaceLabel(font)}</span>,
    },
    {
      id: 'team',
      width: '8rem',
      from: 'md',
      header: 'Ekip',
      cell: (font) => <span className={TEXT_SECONDARY}>{teamLabel(font.ownerTeam)}</span>,
    },
    {
      id: 'turkish',
      width: '9rem',
      header: 'Türkçe',
      cell: (font) =>
        font.missingTurkish ? (
          <span className={cn('text-warning flex items-center gap-1', TEXT_SECONDARY)}>
            <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">eksik: {missingLettersText(font.missingTurkish)}</span>
          </span>
        ) : (
          <span className={cn('text-success flex items-center gap-1', TEXT_SECONDARY)}>
            <Check className="size-3.5" aria-hidden /> Tam
          </span>
        ),
    },
    {
      id: 'added',
      width: '9rem',
      from: 'lg',
      header: 'Eklendi',
      cell: (font) => (
        <span className={TEXT_SECONDARY}>
          {addedOn(font.createdAt)}
          {font.uploadedBy && font.uploadedBy === user?.id ? ' · sen' : ''}
        </span>
      ),
    },
    {
      id: 'menu',
      width: '2.5rem',
      align: 'end',
      label: 'Eylemler',
      cell: (font) =>
        canArchive(font) ? (
          <RowMenu rowName={font.family}>
            <MenuItem icon={Archive} destructive onClick={() => askArchive(font)}>
              Arşivle
            </MenuItem>
          </RowMenu>
        ) : null,
    },
  ];

  return (
    <ListPage
      title="Sertifika yazı tipleri"
      commands={
        <CommandBar label="Yazı tipi komutları">
          {canUpload ? (
            <Command primary icon={Upload} label="Yazı tipi yükle" onClick={openUpload} />
          ) : null}
          <Command icon={RefreshCw} label="Yenile" onClick={load} />
        </CommandBar>
      }
      toolbar={
        <ListToolbar
          query={params.q}
          onQuery={(q) => setParams({ q })}
          commitDelay={250}
          placeholder="Aile ya da ekip"
          searchLabel="Yazı tipi ara"
        >
          {teams.length ? (
            <Select
              aria-label="Ekip"
              className="w-auto"
              value={shownTeam}
              onChange={(event) => setTeam(event.target.value)}
            >
              <option value="">Yalnız kulüp geneli</option>
              {teams.map((ownerTeam) => (
                <option key={ownerTeam} value={ownerTeam}>
                  {ownerTeam} ve kulüp geneli
                </option>
              ))}
            </Select>
          ) : null}
        </ListToolbar>
      }
    >
      {failed ? (
        <EmptyState kind="failed" title={failed} onRetry={load} />
      ) : fonts !== null && !shown.length ? (
        params.q.trim() ? (
          <EmptyState kind="no-results" onClear={() => setParams({ q: '' })} />
        ) : (
          <EmptyState kind="first-use" title="Henüz yazı tipi yok" />
        )
      ) : (
        <DataList
          density="comfortable"
          columns={columns}
          rows={shown}
          getRowId={(font) => font.id}
          rowLabel={(font) => `${font.family} ${fontFaceLabel(font)}`}
          loading={fonts === null}
          skeletonRows={4}
        />
      )}
      <SidePanel
        open={uploadOpen && canUpload}
        title="Yazı tipi yükle"
        dirty={Boolean(file)}
        onClose={() => setUploadOpen(false)}
      >
        <form className="space-y-4" onSubmit={upload}>
          {wantedFamily ? (
            <p className={cn('text-secondary-foreground', TEXT_SECONDARY)}>
              PDF&apos;teki yazı tipi: <strong className="font-medium">{wantedFamily}</strong>
            </p>
          ) : null}
          <div className="space-y-1.5">
            <label className="block space-y-1.5">
              <FieldLabel>Dosya</FieldLabel>
              <input
                type="file"
                accept={FONT_FILE_TYPES}
                className="text-secondary-foreground file:border-border file:bg-background file:text-foreground block w-full text-sm file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setUploadError(undefined);
                }}
              />
            </label>
            <span className={cn('text-subtle-foreground block', TEXT_SECONDARY)}>
              TTF, OTF ya da WOFF2; en çok 10 MB, tek kalınlık.
            </span>
          </div>
          <label className="block space-y-1.5">
            <FieldLabel>Ekip</FieldLabel>
            <Select
              value={chosenTeam ?? ''}
              onChange={(event) => setUploadTeam(event.target.value)}
            >
              {clubUpload ? <option value="">Kulüp geneli</option> : null}
              {uploadTeams.map((ownerTeam) => (
                <option key={ownerTeam} value={ownerTeam}>
                  {ownerTeam}
                </option>
              ))}
            </Select>
          </label>
          {uploadError ? (
            <p role="alert" className={cn('text-destructive', TEXT_SECONDARY)}>
              {uploadError}
            </p>
          ) : null}
          <SaveButton disabled={!file || uploading || chosenTeam === undefined}>
            {uploading ? 'Yükleniyor…' : 'Yükle'}
          </SaveButton>
        </form>
      </SidePanel>
      {confirmDialog}
    </ListPage>
  );
}
