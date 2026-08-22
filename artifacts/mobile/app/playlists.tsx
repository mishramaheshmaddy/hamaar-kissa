import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

import { useColors } from "@/hooks/useColors";
import {
  addToPlaylist,
  ApiAudioStory,
  ApiPlaylist,
  ApiPlaylistWithItems,
  createPlaylist,
  deletePlaylist,
  getPlaylist,
  getPlaylists,
  removeFromPlaylist,
} from "@/lib/api";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function PlaylistsScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{
    id?: string;
    addStoryId?: string;
  }>();
  const [playlists, setPlaylists] = useState<ApiPlaylist[]>([]);
  const [playlist, setPlaylist] = useState<ApiPlaylistWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<number[]>([]);

  const playlistId = params.id ? Number(params.id) : null;
  const addStoryId = params.addStoryId ? Number(params.addStoryId) : null;

  const load = useCallback(async () => {
    try {
      if (playlistId) {
        const data = await getPlaylist(playlistId);
        setPlaylist(data);
      } else {
        const data = await getPlaylists();
        setPlaylists(data);

        if (addStoryId) {
          if (data.length === 0) {
            // CASE 1:
            // User wants to add the current audio but has no playlist.
            // Open the existing create-playlist popup.
            setSelectMode(false);
            setSelectedPlaylistIds([]);
            setShowCreate(true);
          } else {
            // CASE 2:
            // User already has playlists.
            // Show playlist selection mode.
            setSelectMode(true);
            setSelectedPlaylistIds([]);
            setShowCreate(false);
          }
        } else {
          setSelectMode(false);
          setSelectedPlaylistIds([]);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message === "AUTH_REQUIRED") {
        Alert.alert(
          "लॉगिन जरूरी बा",
          "Playlist इस्तेमाल करे खातिर पहिले लॉगिन करीं।",
          [
            { text: "बाद में", style: "cancel" },
            { text: "लॉगिन", onPress: () => router.push("/login") },
          ],
        );
      } else {
        Alert.alert(
          "कुछ गड़बड़ हो गइल",
          error instanceof Error ? error.message : "फिर से कोशिश करीं।",
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [playlistId, addStoryId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleCreate = async () => {
    const trimmed = name.trim();

    if (!trimmed) {
      Alert.alert("नाम दीं", "Playlist के एगो नाम दीं।");
      return;
    }

    try {
      setSaving(true);

      const created = await createPlaylist(trimmed);

      // If this page was opened from the player with a story,
      // automatically add that story to the newly created playlist.
      if (addStoryId) {
        await addToPlaylist(created.id, addStoryId);
      }

      setName("");
      setShowCreate(false);

      if (addStoryId) {
        // Return directly to the player.
        router.back();
        return;
      }

      await load();
    } catch (error) {
      Alert.alert(
        "Playlist ना बन पवल",
        error instanceof Error ? error.message : "फिर से कोशिश करीं।",
      );
    } finally {
      setSaving(false);
    }
  };

  const togglePlaylistSelection = (playlistId: number) => {
    setSelectedPlaylistIds((current) =>
      current.includes(playlistId)
        ? current.filter((id) => id !== playlistId)
        : [...current, playlistId],
    );
  };

  const handleAddSelected = async () => {
    if (!addStoryId) return;

    if (selectedPlaylistIds.length === 0) {
      Alert.alert(
        "ध्यान दीं",
        "कम से कम एगो playlist चुनल जरूरी बा।",
      );
      return;
    }

    try {
      setSaving(true);

      await Promise.all(
        selectedPlaylistIds.map((playlistId) =>
          addToPlaylist(playlistId, addStoryId),
        ),
      );

      // Return to the player after adding.
      router.back();
    } catch (error) {
      Alert.alert(
        "कहानी ना जुड़ पवल",
        error instanceof Error ? error.message : "फिर से कोशिश करीं।",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!playlist) return;

    Alert.alert(
      "Playlist मिटाईं?",
      `"${playlist.name}" के पूरा playlist मिटा दीं?`,
      [
        { text: "रद्द करीं", style: "cancel" },
        {
          text: "मिटाईं",
          style: "destructive",
          onPress: async () => {
            try {
              await deletePlaylist(playlist.id);
              router.back();
            } catch (error) {
              Alert.alert(
                "मिट ना पवल",
                error instanceof Error ? error.message : "फिर से कोशिश करीं।",
              );
            }
          },
        },
      ],
    );
  };

  const handleRemove = (itemId: number) => {
    if (!playlist) return;

    Alert.alert("कहानी हटाईं?", "ई कहानी playlist से हटा दीं?", [
      { text: "रद्द करीं", style: "cancel" },
      {
        text: "हटाईं",
        style: "destructive",
        onPress: async () => {
          try {
            await removeFromPlaylist(playlist.id, itemId);
            await load();
          } catch (error) {
            Alert.alert(
              "हट ना पवल",
              error instanceof Error ? error.message : "फिर से कोशिश करीं।",
            );
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (playlistId && playlist) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>

          <View style={styles.headerText}>
            <Text
              style={[styles.title, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {playlist.name}
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {playlist.items.length} कहानी
            </Text>
          </View>

          <TouchableOpacity onPress={handleDelete}>
            <Feather name="trash-2" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={playlist.items}
          keyExtractor={(item) => String(item.itemId)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={
            playlist.items.length === 0 ? styles.emptyContainer : styles.list
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.storyRow,
                { borderBottomColor: colors.border },
              ]}
              onPress={() =>
                router.push({
                  pathname: "/audio/player",
                  params: { id: String(item.story.id) },
                })
              }
            >
              <View
                style={[
                  styles.storyIcon,
                  { backgroundColor: colors.secondary },
                ]}
              >
                <Feather
                  name="headphones"
                  size={18}
                  color={colors.primary}
                />
              </View>

              <View style={styles.storyInfo}>
                <Text
                  style={[styles.storyTitle, { color: colors.foreground }]}
                  numberOfLines={2}
                >
                  {item.story.title}
                </Text>
                <Text
                  style={[
                    styles.storyNarrator,
                    { color: colors.mutedForeground },
                  ]}
                  numberOfLines={1}
                >
                  {item.story.narrator || "हमार किस्सा"}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemove(item.itemId)}
              >
                <Feather
                  name="x"
                  size={18}
                  color={colors.mutedForeground}
                />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather
                name="headphones"
                size={42}
                color={colors.mutedForeground}
              />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                अभी playlist खाली बा
              </Text>
              <Text
                style={[
                  styles.emptyText,
                  { color: colors.mutedForeground },
                ]}
              >
                सुनीं page से कहानी playlist में जोड़ सकत बानी।
              </Text>

              <TouchableOpacity
                onPress={() => router.push("/(tabs)/audio")}
                style={[
                  styles.emptyAddButton,
                  { backgroundColor: colors.primary },
                ]}
                accessibilityLabel="कहानी जोड़ें"
              >
                <Feather name="plus" size={32} color="#fff" />
              </TouchableOpacity>
            </View>
          }
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>

        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            हमार playlist
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            अपना पसंद के कहानी एक जगह रखीं
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => setShowCreate(true)}
        >
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={playlists}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={
          playlists.length === 0 ? styles.emptyContainer : styles.list
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.playlistRow,
              {
                backgroundColor: colors.secondary,
                borderColor: colors.border,
              },
            ]}
            onPress={() =>
              router.push(
                `/playlists?id=${item.id}` as any
              )
            }
          >
            <View
              style={[
                styles.playlistIcon,
                { backgroundColor: colors.background },
              ]}
            >
              <Feather name="list" size={22} color={colors.primary} />
            </View>

            <View style={styles.playlistInfo}>
              <Text
                style={[styles.playlistName, { color: colors.foreground }]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text
                style={[
                  styles.playlistDate,
                  { color: colors.mutedForeground },
                ]}
              >
                हमार playlist
              </Text>
            </View>

            <Feather
              name="chevron-right"
              size={20}
              color={colors.mutedForeground}
            />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather
              name="list"
              size={48}
              color={colors.mutedForeground}
            />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              अभी कवनो playlist नइखे
            </Text>
            <Text
              style={[styles.emptyText, { color: colors.mutedForeground }]}
            >
              ऊपर + दबाईं आ आपन पहिला playlist बनाईं।
            </Text>
          </View>
        }
      />

      <Modal
        visible={showCreate}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreate(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowCreate(false)}
        >
          <Pressable
            style={[
              styles.modal,
              { backgroundColor: colors.background },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              नया playlist
            </Text>

            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="जइसे — रात के कहानी"
              placeholderTextColor={colors.mutedForeground}
              autoFocus
              maxLength={60}
              style={[
                styles.input,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.secondary,
                },
              ]}
              onSubmitEditing={handleCreate}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setName("");
                  setShowCreate(false);
                }}
              >
                <Text
                  style={[
                    styles.cancelText,
                    { color: colors.mutedForeground },
                  ]}
                >
                  रद्द करीं
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.createButton,
                  { backgroundColor: colors.primary },
                ]}
                onPress={handleCreate}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.createText}>बनाईं</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    paddingTop: 58,
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    padding: 16,
    paddingTop: 4,
    paddingBottom: 32,
  },
  playlistRow: {
    minHeight: 72,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  playlistIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  playlistInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playlistName: {
    fontSize: 16,
    fontWeight: "800",
  },
  playlistDate: {
    fontSize: 11,
    marginTop: 4,
  },
  storyRow: {
    minHeight: 74,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
  },
  storyIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  storyInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  storyTitle: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  storyNarrator: {
    fontSize: 11,
    marginTop: 3,
  },
  removeButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: 14,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
    textAlign: "center",
  },
  emptyAddButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  modal: {
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 16,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 18,
    gap: 10,
  },
  cancelButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "700",
  },
  createButton: {
    minWidth: 80,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  createText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
});
