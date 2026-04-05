/**
 * Area Notes Screen — per-area chat-like note log.
 *
 * Accessible from Today → Up Next (long press) or any AreaCard.
 * Shows all notes for a specific area in chronological order.
 * User messages on the right, others on the left, system notes centered.
 *
 * Writes go to PowerSync local DB first → syncs to Supabase.
 * Carlos Standard: works offline, no spinners.
 */

import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../src/providers/AuthProvider';
import { usePowerSync } from '@readyboard/shared';

// ─── Types ──────────────────────────────────────────

type AreaNote = {
  id: string;
  area_id: string;
  project_id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  content: string;
  is_system: number;
  created_at: string;
};

// ─── Helpers ─────────────────────────────────────────

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Main Component ───────────────────────────────────

export default function AreaNotesScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { db } = usePowerSync();
  const params = useLocalSearchParams<{ areaId: string; areaName: string; areaCode: string; projectId: string }>();

  const areaId = params.areaId ?? '';
  const areaName = params.areaName ?? 'Area';
  const areaCode = params.areaCode ?? '';
  const projectId = params.projectId ?? '';

  const userId = session?.user.id ?? '';
  const userName = session?.user.user_metadata?.name ?? session?.user.email ?? 'Unknown';
  const userRole = session?.user.user_metadata?.role ?? 'foreman';

  const [notes, setNotes] = useState<AreaNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<AreaNote>>(null);

  const loadNotes = useCallback(async () => {
    if (!areaId || !db) return;
    try {
      const rows = await db.getAll<AreaNote>(
        `SELECT * FROM area_notes WHERE area_id = ? ORDER BY created_at ASC LIMIT 50`,
        [areaId]
      );
      setNotes(rows);
      // Scroll to bottom
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    } catch (err) {
      console.warn('[AreaNotes] load error:', err);
    }
  }, [areaId, db]);

  useFocusEffect(
    useCallback(() => {
      loadNotes();
    }, [loadNotes])
  );

  async function handleSend() {
    const text = newNote.trim();
    if (!text || sending) return;

    setSending(true);
    setNewNote('');

    const note: AreaNote = {
      id: generateUUID(),
      area_id: areaId,
      project_id: projectId,
      author_id: userId,
      author_name: userName,
      author_role: userRole,
      content: text,
      is_system: 0,
      created_at: new Date().toISOString(),
    };

    // Optimistic UI
    setNotes((prev) => [...prev, note]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      await db.execute(
        `INSERT INTO area_notes (id, area_id, project_id, author_id, author_name, author_role, content, is_system, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [note.id, note.area_id, note.project_id, note.author_id, note.author_name, note.author_role, note.content, 0, note.created_at]
      );
    } catch (err) {
      console.error('[AreaNotes] insert error:', err);
      // Remove optimistic note on failure
      setNotes((prev) => prev.filter((n) => n.id !== note.id));
      setNewNote(text);
    } finally {
      setSending(false);
    }
  }

  const topPad = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 8 : 52;

  function renderNote({ item: note }: { item: AreaNote }) {
    const isMe = note.author_id === userId;
    const isSystem = note.is_system === 1;

    if (isSystem) {
      return (
        <View style={styles.systemNote}>
          <Text style={styles.systemText}>{note.content}</Text>
          <Text style={styles.systemTime}>{formatTime(note.created_at)}</Text>
        </View>
      );
    }

    return (
      <View style={[styles.noteRow, isMe ? styles.noteRowRight : styles.noteRowLeft]}>
        {!isMe && (
          <Text style={styles.noteMeta}>{note.author_name} · {note.author_role}</Text>
        )}
        <View style={[styles.noteBubble, isMe ? styles.noteBubbleMe : styles.noteBubbleOther]}>
          <Text style={styles.noteContent}>{note.content}</Text>
        </View>
        <Text style={[styles.noteTime, isMe ? styles.noteTimeRight : styles.noteTimeLeft]}>
          {formatTime(note.created_at)}
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: topPad }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <View style={styles.titleRow}>
          {areaCode ? (
            <View style={styles.codeTag}>
              <Text style={styles.codeText}>{areaCode}</Text>
            </View>
          ) : null}
          <Text style={styles.title} numberOfLines={1}>{areaName}</Text>
        </View>
        <Text style={styles.subtitle}>Notes & updates</Text>
      </View>

      {/* Notes list */}
      <FlatList
        ref={listRef}
        data={notes}
        keyExtractor={(n) => n.id}
        renderItem={renderNote}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No notes yet</Text>
            <Text style={styles.emptyHint}>Be the first to add a note for this area</Text>
          </View>
        }
      />

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TextInput
          value={newNote}
          onChangeText={setNewNote}
          placeholder="Add a note…"
          placeholderTextColor="#475569"
          multiline
          style={styles.input}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        <Pressable
          onPress={handleSend}
          disabled={!newNote.trim() || sending}
          style={[styles.sendBtn, newNote.trim() ? styles.sendBtnActive : styles.sendBtnDisabled]}
        >
          <Text style={styles.sendIcon}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: {
    marginBottom: 8,
  },
  backText: {
    color: '#60a5fa',
    fontSize: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codeTag: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    color: '#475569',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1f5f9',
    flex: 1,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  listContent: {
    padding: 16,
    paddingBottom: 8,
    flexGrow: 1,
  },
  // Note bubbles
  noteRow: {
    marginBottom: 12,
    maxWidth: '85%',
  },
  noteRowRight: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  noteRowLeft: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  noteMeta: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 3,
  },
  noteBubble: {
    padding: 12,
    borderRadius: 14,
  },
  noteBubbleMe: {
    backgroundColor: 'rgba(96,165,250,0.18)',
    borderBottomRightRadius: 4,
  },
  noteBubbleOther: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderBottomLeftRadius: 4,
  },
  noteContent: {
    fontSize: 15,
    color: '#e2e8f0',
    lineHeight: 21,
  },
  noteTime: {
    fontSize: 10,
    color: '#334155',
    marginTop: 3,
  },
  noteTimeRight: {
    textAlign: 'right',
  },
  noteTimeLeft: {
    textAlign: 'left',
  },
  // System notes
  systemNote: {
    alignSelf: 'center',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  systemText: {
    fontSize: 11,
    color: '#475569',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  systemTime: {
    fontSize: 9,
    color: '#334155',
    marginTop: 2,
  },
  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: {
    color: '#334155',
    fontSize: 15,
    fontWeight: '600',
  },
  emptyHint: {
    color: '#1e293b',
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
  // Input
  inputBar: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#0d1426',
  },
  input: {
    flex: 1,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    color: '#f1f5f9',
    fontSize: 15,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  sendBtnActive: {
    backgroundColor: '#60a5fa',
  },
  sendBtnDisabled: {
    backgroundColor: '#1e293b',
  },
  sendIcon: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
});
