/**
 * Today Tab — Foreman Daily Hub
 *
 * Replaces the old "Report" tab with a daily command center:
 *   1. My Shift    — today's stats (areas reported, photos, blockers)
 *   2. Up Next     — assigned areas sorted by priority (ready first)
 *   3. Photos Today — horizontal strip of today's progress photos
 *   4. Messages    — area_notes from project team
 *
 * All data from PowerSync local SQLite — works 100% offline.
 * Carlos Standard: no spinners, shows 0 instantly, fills in as sync catches up.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../../src/providers/AuthProvider';
import { useAreas, useReportStore, usePowerSync, type AssignedArea, type AreaStatus } from '@readyboard/shared';

// ─── Types ──────────────────────────────────────────

type ShiftStats = {
  areasReported: number;
  photosTaken: number;
  blockersReported: number;
  hoursWorked: number;
};

type TodayPhoto = {
  id: string;
  photo_url: string;
  area_name: string;
  created_at: string;
};

type AreaNote = {
  id: string;
  area_id: string;
  area_name: string;
  author_id: string;
  author_name: string;
  author_role: string;
  content: string;
  is_system: number;
  created_at: string;
};

// ─── Status config ───────────────────────────────────

const STATUS_CONFIG: Record<AreaStatus, { dot: string; border: string; text: string; label: string }> = {
  ready:    { dot: '#22c55e', border: 'rgba(34,197,94,0.25)',  text: '#22c55e', label: 'Ready — work here now' },
  almost:   { dot: '#eab308', border: 'rgba(234,179,8,0.25)',  text: '#eab308', label: 'Almost ready' },
  working:  { dot: '#3b82f6', border: 'rgba(59,130,246,0.2)',  text: '#60a5fa', label: 'In progress' },
  held:     { dot: '#a855f7', border: 'rgba(168,85,247,0.2)',  text: '#c084fc', label: 'Held — awaiting GC' },
  blocked:  { dot: '#ef4444', border: 'rgba(239,68,68,0.2)',   text: '#f87171', label: 'Blocked' },
};

const AREA_PRIORITY: Record<AreaStatus, number> = {
  ready: 0, working: 1, almost: 2, held: 3, blocked: 4,
};

// ─── Sub-components ──────────────────────────────────

function StatBox({ icon, value, label, color }: { icon: string; value: number; label: string; color: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDate(iso: string): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

// ─── Main Screen ─────────────────────────────────────

export default function TodayScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { db } = usePowerSync();
  const userId = session?.user.id ?? '';
  const { areas, isLoading, refresh } = useAreas(userId);
  const startReport = useReportStore((s) => s.startReport);

  const [stats, setStats] = useState<ShiftStats>({ areasReported: 0, photosTaken: 0, blockersReported: 0, hoursWorked: 0 });
  const [todayPhotos, setTodayPhotos] = useState<TodayPhoto[]>([]);
  const [messages, setMessages] = useState<AreaNote[]>([]);

  const loadTodayData = useCallback(async () => {
    if (!userId || !db) return;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    try {
      // Areas reported today
      const reportedRows = await db.getAll<{ count: number }>(
        `SELECT COUNT(DISTINCT area_id) as count FROM field_reports WHERE user_id = ? AND created_at >= ?`,
        [userId, todayISO]
      );

      // Photos taken today (field_reports with photo_url)
      const photoRows = await db.getAll<{ count: number }>(
        `SELECT COUNT(*) as count FROM field_reports WHERE user_id = ? AND created_at >= ? AND photo_url IS NOT NULL`,
        [userId, todayISO]
      );

      // Blockers reported today
      const blockerRows = await db.getAll<{ count: number }>(
        `SELECT COUNT(*) as count FROM field_reports WHERE user_id = ? AND created_at >= ? AND status = 'blocked'`,
        [userId, todayISO]
      );

      // First report time (for hours worked calc)
      const firstRows = await db.getAll<{ start_time: string | null }>(
        `SELECT MIN(created_at) as start_time FROM field_reports WHERE user_id = ? AND created_at >= ?`,
        [userId, todayISO]
      );

      const firstReportTime = firstRows[0]?.start_time;
      const hoursWorked = firstReportTime
        ? Math.round((Date.now() - new Date(firstReportTime).getTime()) / 3600000)
        : 0;

      setStats({
        areasReported: Number(reportedRows[0]?.count ?? 0),
        photosTaken: Number(photoRows[0]?.count ?? 0),
        blockersReported: Number(blockerRows[0]?.count ?? 0),
        hoursWorked,
      });

      // Today's photos with area names
      const photoData = await db.getAll<TodayPhoto>(
        `SELECT fr.id, fr.photo_url, fr.created_at, a.name as area_name
         FROM field_reports fr
         LEFT JOIN areas a ON a.id = fr.area_id
         WHERE fr.user_id = ? AND fr.created_at >= ? AND fr.photo_url IS NOT NULL
         ORDER BY fr.created_at DESC LIMIT 20`,
        [userId, todayISO]
      );
      setTodayPhotos(photoData);

      // Task photos today (area_tasks completed by this user today)
      const taskPhotoData = await db.getAll<TodayPhoto>(
        `SELECT at.id, at.photo_url, at.completed_at as created_at, a.name as area_name
         FROM area_tasks at
         LEFT JOIN areas a ON a.id = at.area_id
         WHERE at.completed_by = ? AND at.completed_at >= ? AND at.photo_url IS NOT NULL
         ORDER BY at.completed_at DESC LIMIT 10`,
        [userId, todayISO]
      );
      // Merge and deduplicate
      const allPhotos = [...photoData, ...taskPhotoData]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 20);
      setTodayPhotos(allPhotos);

      // Messages: area_notes for my assigned areas (last 7 days so there's always something)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const areaIds = areas.map((a) => a.id);
      if (areaIds.length > 0) {
        const placeholders = areaIds.map(() => '?').join(',');
        const noteData = await db.getAll<AreaNote>(
          `SELECT an.*, a.name as area_name
           FROM area_notes an
           LEFT JOIN areas a ON a.id = an.area_id
           WHERE an.area_id IN (${placeholders}) AND an.created_at >= ?
           ORDER BY an.created_at DESC LIMIT 15`,
          [...areaIds, sevenDaysAgo]
        );
        setMessages(noteData);
      }
    } catch (err) {
      console.warn('[TodayScreen] loadTodayData error:', err);
    }
  }, [userId, db, areas]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      loadTodayData();
    }, [refresh, loadTodayData])
  );

  useEffect(() => {
    loadTodayData();
  }, [areas]);

  // Up Next: prioritized areas
  const upNextAreas = [...areas]
    .sort((a, b) => AREA_PRIORITY[a.status] - AREA_PRIORITY[b.status])
    .slice(0, 8);

  function handleReportArea(area: AssignedArea) {
    startReport({
      area_id: area.id,
      area_name: area.name,
      floor: area.floor,
      trade_name: area.trade_name,
      user_id: userId,
      reporting_mode: area.reporting_mode,
      area_code: area.area_code,
      area_description: area.description,
      unit_name: area.unit_name,
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(main)/report');
  }

  function handleOpenNotes(area: AssignedArea) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/(main)/area-notes', params: { areaId: area.id, areaName: area.name, areaCode: area.area_code ?? '', projectId: area.project_id } });
  }

  const topPad = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 8 : 52;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.title}>Today</Text>
          <Text style={styles.subtitle}>{formatDate(new Date().toISOString())}</Text>
        </View>

        {/* ── Section 1: My Shift ── */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>MY SHIFT</Text>
          <View style={styles.statsRow}>
            <StatBox icon="⏱" value={stats.hoursWorked} label="Hours" color="#60a5fa" />
            <StatBox icon="📋" value={stats.areasReported} label="Reported" color="#4ade80" />
            <StatBox icon="📷" value={stats.photosTaken} label="Photos" color="#fbbf24" />
            <StatBox icon="🔴" value={stats.blockersReported} label="Blockers" color="#f87171" />
          </View>
        </View>

        {/* ── Section 2: Up Next ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>UP NEXT</Text>

          {isLoading && areas.length === 0 ? (
            <Text style={styles.emptyText}>Loading areas…</Text>
          ) : upNextAreas.length === 0 ? (
            <Text style={styles.emptyText}>No areas assigned yet</Text>
          ) : (
            upNextAreas.map((area) => {
              const cfg = STATUS_CONFIG[area.status];
              const statusText =
                area.status === 'ready' ? 'Ready — work here now' :
                area.status === 'working' ? `${area.effective_pct}% complete` :
                area.status === 'almost' ? 'Almost ready — coming soon' :
                area.status === 'held' ? 'Held — awaiting GC' :
                'Blocked';
              return (
                <Pressable
                  key={area.id}
                  onPress={() => handleReportArea(area)}
                  onLongPress={() => handleOpenNotes(area)}
                  style={[styles.areaRow, { borderColor: cfg.border }]}
                >
                  <View style={[styles.statusDot, { backgroundColor: cfg.dot }]} />
                  <View style={styles.areaInfo}>
                    <View style={styles.areaNameRow}>
                      {area.area_code ? (
                        <View style={styles.codeTag}>
                          <Text style={styles.codeText}>{area.area_code}</Text>
                        </View>
                      ) : null}
                      <Text style={styles.areaName}>{area.name}</Text>
                      {area.unit_name ? <Text style={styles.unitName}>{area.unit_name}</Text> : null}
                    </View>
                    <Text style={[styles.statusText, { color: cfg.text }]}>{statusText}</Text>
                  </View>
                  <Text style={styles.arrow}>→</Text>
                </Pressable>
              );
            })
          )}

          {areas.length > 8 && (
            <Pressable onPress={() => router.replace('/(main)/(tabs)')} style={styles.viewAllBtn}>
              <Text style={styles.viewAllText}>View all {areas.length} areas →</Text>
            </Pressable>
          )}
        </View>

        {/* ── Section 3: Photos Today ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>PHOTOS TODAY</Text>
          </View>

          {todayPhotos.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
              {todayPhotos.map((photo) => (
                <View key={photo.id} style={styles.photoItem}>
                  <Image
                    source={{ uri: photo.photo_url }}
                    style={styles.photoThumb}
                    resizeMode="cover"
                  />
                  <Text style={styles.photoAreaName} numberOfLines={1}>{photo.area_name ?? '—'}</Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyPhotos}>
              <Text style={styles.emptyText}>No photos yet today</Text>
              <Text style={styles.emptyHint}>Take progress photos from any area report</Text>
            </View>
          )}
        </View>

        {/* ── Section 4: Messages ── */}
        <View style={[styles.section, styles.lastSection]}>
          <Text style={styles.sectionLabel}>MESSAGES</Text>

          {messages.length === 0 ? (
            <View style={styles.emptyMessages}>
              <Text style={styles.emptyText}>No messages this week</Text>
            </View>
          ) : (
            messages.map((msg) => (
              <View
                key={msg.id}
                style={[
                  styles.messageCard,
                  { borderLeftColor: msg.is_system ? '#1e293b' : '#60a5fa' },
                  msg.is_system ? styles.messageSystem : styles.messageHuman,
                ]}
              >
                {!msg.is_system ? (
                  <>
                    <View style={styles.msgMeta}>
                      <Text style={styles.msgAuthor}>{msg.author_name} · {msg.author_role}</Text>
                      <Text style={styles.msgTime}>{formatRelativeTime(msg.created_at)}</Text>
                    </View>
                    <Text style={styles.msgContent}>{msg.content}</Text>
                  </>
                ) : (
                  <Text style={styles.msgSystemContent}>{msg.content}</Text>
                )}
                {msg.area_name ? (
                  <Text style={styles.msgArea}>📍 {msg.area_name}</Text>
                ) : null}
              </View>
            ))
          )}
        </View>

      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scroll: {
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 4,
    paddingTop: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f1f5f9',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  card: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  lastSection: {
    paddingBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  // Stat boxes
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  // Area rows
  areaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  areaInfo: {
    flex: 1,
  },
  areaNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  codeTag: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    color: '#475569',
  },
  areaName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  unitName: {
    fontSize: 11,
    color: '#475569',
  },
  statusText: {
    fontSize: 12,
    marginTop: 2,
  },
  arrow: {
    color: '#475569',
    fontSize: 18,
  },
  viewAllBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  viewAllText: {
    color: '#60a5fa',
    fontSize: 13,
  },
  // Photos
  photoStrip: {
    marginHorizontal: -4,
  },
  photoItem: {
    marginHorizontal: 4,
    width: 88,
  },
  photoThumb: {
    width: 88,
    height: 88,
    borderRadius: 10,
    backgroundColor: '#1e293b',
  },
  photoAreaName: {
    fontSize: 9,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 3,
  },
  emptyPhotos: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderStyle: 'dashed',
  },
  emptyText: {
    color: '#334155',
    fontSize: 13,
  },
  emptyHint: {
    color: '#1e3a5f',
    fontSize: 11,
    marginTop: 4,
  },
  // Messages
  emptyMessages: {
    padding: 20,
    alignItems: 'center',
  },
  messageCard: {
    padding: 12,
    marginBottom: 8,
    borderRadius: 10,
    borderLeftWidth: 3,
  },
  messageHuman: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  messageSystem: {
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  msgMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  msgAuthor: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  msgTime: {
    fontSize: 10,
    color: '#475569',
  },
  msgContent: {
    fontSize: 14,
    color: '#e2e8f0',
    lineHeight: 20,
  },
  msgSystemContent: {
    fontSize: 12,
    color: '#475569',
    fontStyle: 'italic',
  },
  msgArea: {
    fontSize: 11,
    color: '#475569',
    marginTop: 4,
  },
});
