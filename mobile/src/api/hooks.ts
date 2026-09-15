import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthProvider";
import { api } from "./client";
import type {
  Card,
  DetailResponse,
  EditableDraft,
  HostListing,
  InboxItem,
  Me,
  Message,
  Meta,
  Page,
  QueueListing,
  QueueReport,
  SavedCard,
  SavedSearch,
  User,
  SearchQuery,
  Thread,
} from "./types";

export const keys = {
  meta: ["meta"] as const,
  me: ["me"] as const,
  listings: (q: SearchQuery) => ["listings", q] as const,
  map: (q: SearchQuery) => ["listings-map", q] as const,
  listing: (id: string) => ["listing", id] as const,
  saved: ["saved"] as const,
  searches: ["searches"] as const,
  inbox: ["inbox"] as const,
  thread: (id: string) => ["thread", id] as const,
  host: ["host-listings"] as const,
  hostDraft: (id: string) => ["host-draft", id] as const,
  queue: ["admin-queue"] as const,
};

export function useMeta() {
  return useQuery({ queryKey: keys.meta, queryFn: () => api<Meta>("/api/v1/meta"), staleTime: 10 * 60_000 });
}

export function useMe() {
  const { user } = useAuth();
  return useQuery({ queryKey: keys.me, queryFn: () => api<Me>("/api/v1/me"), enabled: !!user, refetchInterval: 60_000 });
}

export function useListings(q: SearchQuery) {
  return useInfiniteQuery({
    queryKey: keys.listings(q),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api<Page<Card>>("/api/v1/listings", { query: { ...q, page: pageParam, pageSize: 20 } }),
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });
}

export function useMapListings(q: SearchQuery, enabled: boolean) {
  return useQuery({
    queryKey: keys.map(q),
    queryFn: () => api<Page<Card>>("/api/v1/listings", { query: { ...q, view: "map" } }),
    enabled,
  });
}

export function useListing(id: string) {
  return useQuery({ queryKey: keys.listing(id), queryFn: () => api<DetailResponse>(`/api/v1/listings/${encodeURIComponent(id)}`) });
}

export function useSaved() {
  const { user } = useAuth();
  return useQuery({ queryKey: keys.saved, queryFn: () => api<{ items: SavedCard[] }>("/api/v1/saved"), enabled: !!user });
}

export function useToggleSave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, saved }: { id: string; saved: boolean }) =>
      saved
        ? api(`/api/v1/saved/${encodeURIComponent(id)}`, { method: "DELETE" })
        : api("/api/v1/saved", { body: { listingId: id } }),
    onMutate: async ({ id, saved }) => {
      /* Optimistic: flip the heart everywhere it is rendered — feed pages,
         map pins, the saved tab and the open detail. */
      const flip = (c: Card) => (c.id === id ? { ...c, saved: !saved } : c);
      qc.setQueriesData<{ pages: Page<Card>[]; pageParams: unknown[] }>({ queryKey: ["listings"] }, (old) =>
        old ? { ...old, pages: old.pages.map((p) => ({ ...p, items: p.items.map(flip) })) } : old,
      );
      qc.setQueriesData<Page<Card>>({ queryKey: ["listings-map"] }, (old) => (old ? { ...old, items: old.items.map(flip) } : old));
      qc.setQueryData<{ items: SavedCard[] }>(keys.saved, (old) =>
        old && saved ? { ...old, items: old.items.filter((c) => c.id !== id) } : old,
      );
      qc.setQueryData<DetailResponse>(keys.listing(id), (old) => (old ? { ...old, viewer: { ...old.viewer, saved: !saved } } : old));
    },
    onSettled: (_d, _e, { id }) => {
      qc.invalidateQueries({ queryKey: keys.saved });
      qc.invalidateQueries({ queryKey: keys.listing(id) });
      qc.invalidateQueries({ queryKey: ["listings"] });
      qc.invalidateQueries({ queryKey: ["listings-map"] });
    },
  });
}

export function useSearches() {
  const { user } = useAuth();
  return useQuery({ queryKey: keys.searches, queryFn: () => api<{ items: SavedSearch[] }>("/api/v1/searches"), enabled: !!user });
}

export function useSaveSearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { label: string; query: SearchQuery; alerts: boolean }) => api<SavedSearch>("/api/v1/searches", { body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.searches }),
  });
}

export function useUpdateSearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, alerts, remove }: { id: string; alerts?: boolean; remove?: boolean }) =>
      remove
        ? api(`/api/v1/searches/${id}`, { method: "DELETE" })
        : api(`/api/v1/searches/${id}`, { method: "PATCH", body: { alerts } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.searches }),
  });
}

export function useInbox() {
  const { user } = useAuth();
  return useQuery({
    queryKey: keys.inbox,
    queryFn: () => api<{ items: InboxItem[] }>("/api/v1/conversations"),
    enabled: !!user,
    refetchInterval: 30_000,
  });
}

export function useThread(id: string) {
  return useQuery({
    queryKey: keys.thread(id),
    queryFn: () => api<Thread>(`/api/v1/conversations/${id}`),
    refetchInterval: 8_000,
  });
}

export function useSendMessage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api<Message>(`/api/v1/conversations/${id}`, { body: { body } }),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: keys.thread(id) });
      const tempId = `tmp-${Date.now()}`;
      qc.setQueryData<Thread>(keys.thread(id), (old) =>
        old ? { ...old, messages: [...old.messages, { id: tempId, body, mine: true, at: new Date().toISOString(), signals: [], pending: true }] } : old,
      );
      return { tempId };
    },
    onError: (_e, _b, ctx) => {
      qc.setQueryData<Thread>(keys.thread(id), (old) => (old ? { ...old, messages: old.messages.filter((m) => m.id !== ctx?.tempId) } : old));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.thread(id) });
      qc.invalidateQueries({ queryKey: keys.inbox });
    },
  });
}

export function useArchiveConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      api(`/api/v1/conversations/${id}`, { method: "PATCH", body: { archived } }),
    onMutate: async ({ id, archived }) => {
      if (!archived) return;
      await qc.cancelQueries({ queryKey: keys.inbox });
      qc.setQueryData<{ items: InboxItem[] }>(keys.inbox, (old) => (old ? { ...old, items: old.items.filter((c) => c.id !== id) } : old));
    },
    onSettled: (_d, _e, { id }) => {
      qc.invalidateQueries({ queryKey: keys.inbox });
      qc.invalidateQueries({ queryKey: keys.thread(id) });
    },
  });
}

export function useStartConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { listingId: string; body: string }) => api<{ conversationId: string }>("/api/v1/conversations", { body: input }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: keys.inbox });
      qc.invalidateQueries({ queryKey: keys.listing(v.listingId) });
    },
  });
}

export function useHostListings() {
  const { user } = useAuth();
  return useQuery({ queryKey: keys.host, queryFn: () => api<{ items: HostListing[] }>("/api/v1/host/listings"), enabled: !!user });
}

/** The stored listing in the composer's shape, for editing. */
export function useHostDraft(id: string | undefined) {
  return useQuery({
    queryKey: keys.hostDraft(id ?? ""),
    queryFn: () => api<{ draft: EditableDraft }>(`/api/v1/host/listings/${encodeURIComponent(id ?? "")}`),
    enabled: !!id,
    staleTime: 0,
  });
}

/** Renter → host, in one tap. The server refuses anything else. */
export function useBecomeHost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ user: User }>("/api/v1/me", { method: "PATCH", body: { role: "host" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.me }),
  });
}

export function useSetListingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/api/v1/host/listings/${encodeURIComponent(id)}`, { method: "PATCH", body: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.host }),
  });
}

export function useDeleteListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/v1/host/listings/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.host }),
  });
}

export function useQueue(enabled: boolean) {
  return useQuery({
    queryKey: keys.queue,
    queryFn: () => api<{ listings: QueueListing[]; reports: QueueReport[] }>("/api/v1/admin/queue"),
    enabled,
  });
}

export function useReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: "approved" | "declined"; note: string }) =>
      api(`/api/v1/admin/listings/${encodeURIComponent(id)}`, { body: { decision, note } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.queue }),
  });
}

export function useResolveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, unpublish }: { id: string; status: "actioned" | "dismissed"; unpublish?: boolean }) =>
      api(`/api/v1/admin/reports/${id}`, { body: { status, unpublish } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.queue }),
  });
}

export function useReport() {
  return useMutation({
    mutationFn: (input: { reason: string; note?: string; listingId?: string; userId?: string; messageId?: string }) =>
      api("/api/v1/reports", { body: input }),
  });
}

export function useBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, unblock }: { userId: string; unblock?: boolean }) =>
      api("/api/v1/blocks", { method: unblock ? "DELETE" : "POST", body: { userId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["thread"] }),
  });
}
