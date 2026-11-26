'use client';

import { useEffect, useState } from 'react';
import { PickerDrawer, type PickerOption } from '@/components/chrome/PickerDrawer';
import { SaveButton } from '@/components/chrome/SaveButton';
import {
  FORM_ROLE_VIEWER,
  FORM_STATUS_OPEN,
  listMyForms,
  readFormTitle,
  type MyForm,
} from '@/lib/api/skyforms';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';

const PAGE_SIZE = 20;

function formOption(form: MyForm): PickerOption {
  const state = form.status === FORM_STATUS_OPEN ? 'Açık' : 'Kapalı';
  return {
    id: form.id,
    title: form.title || 'Adsız form',
    subtitle: `${form.responseCount} yanıt · ${state}`,
    marker: form.userRole <= FORM_ROLE_VIEWER ? 'Görüntüleyen' : undefined,
  };
}

/**
 * The Form slot's form, chosen from the forms the person sees in Forms (`GET /api/admin/forms/`
 * with their own token): search and pages in a drawer. A viewer's form is marked; the mapping
 * below asks for its owner or an editor.
 */
export function SkyformsFormPicker({
  formId,
  onPick,
}: {
  formId: string | null;
  onPick: (form: MyForm) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [forms, setForms] = useState<MyForm[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [title, setTitle] = useState<string | null>(null);

  // The chosen form's title: from the list when it holds it, else read once
  useEffect(() => {
    if (!formId) {
      setTitle(null);
      return;
    }
    const known = forms.find((form) => form.id === formId);
    if (known) {
      setTitle(known.title || 'Adsız form');
      return;
    }
    let cancelled = false;
    void readFormTitle(formId)
      .then((read) => {
        if (!cancelled) setTitle(read || 'Adsız form');
      })
      .catch(() => {
        if (!cancelled) setTitle(null);
      });
    return () => {
      cancelled = true;
    };
    // Read again only for another form, not for each page of the list
  }, [formId]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(
      () => {
        setLoading(true);
        setFailed(false);
        listMyForms({ search: query, page: 1, pageSize: PAGE_SIZE })
          .then((res) => {
            if (cancelled) return;
            setForms(res.items);
            setTotal(res.totalCount);
            setPage(1);
          })
          .catch(() => {
            if (!cancelled) setFailed(true);
          })
          .finally(() => {
            if (!cancelled) setLoading(false);
          });
      },
      query ? 300 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query]);

  async function more() {
    setLoading(true);
    try {
      const res = await listMyForms({ search: query, page: page + 1, pageSize: PAGE_SIZE });
      setForms((rows) => [
        ...rows,
        ...res.items.filter((row) => !rows.some((r) => r.id === row.id)),
      ]);
      setTotal(res.totalCount);
      setPage(page + 1);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`min-w-0 flex-1 truncate ${formId ? '' : 'text-subtle-foreground'} text-sm`}>
        {formId ? (title ?? 'Seçili form') : 'Form seçilmedi'}
      </span>
      <SaveButton type="button" onClick={() => setOpen(true)}>
        {formId ? 'Değiştir' : 'Form seç'}
      </SaveButton>
      <PickerDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Form seç"
        query={query}
        onQuery={setQuery}
        placeholder="Form adı"
        loading={loading && forms.length === 0}
        failed={failed && forms.length === 0}
        options={forms.map(formOption)}
        emptyMessage={query ? 'Eşleşen form yok' : 'Forms’ta formun yok'}
        onPick={(id) => {
          const form = forms.find((row) => row.id === id);
          if (!form) return;
          setTitle(form.title || 'Adsız form');
          onPick(form);
          setOpen(false);
        }}
      >
        {forms.length < total ? (
          <div className="flex justify-center">
            <SaveButton type="button" disabled={loading} onClick={() => void more()}>
              {loading ? 'Yükleniyor…' : 'Daha fazla'}
            </SaveButton>
          </div>
        ) : null}
        {failed && forms.length > 0 ? (
          <p className={`text-destructive ${TEXT_SECONDARY}`}>Formlar yüklenemedi.</p>
        ) : null}
      </PickerDrawer>
    </div>
  );
}
