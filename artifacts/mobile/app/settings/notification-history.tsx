import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { ApiNotificationHistoryItem, getNotificationHistory } from "@/lib/api";

function formatNotificationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("hi-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }) + " • " + date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getNotificationType(item: ApiNotificationHistoryItem) {
  if (item.contentType === "audio") return { icon: "headphones" as const, label: "कहानी" };
  if (item.contentType === "video") return { icon: "video" as const, label: "वीडियो" };
  return { icon: "bell" as const, label: "सूचना" };
}

export default function NotificationHistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const [items, setItems] = useState<ApiNotificationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (pullToRefresh = false) => {
    if (pullToRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);

    try {
      const history = await getNotificationHistory();
      setItems(history);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openNotification = (item: ApiNotificationHistoryItem) => {
    if (item.contentType && item.contentId) {
      router.push(`/content/${item.contentType}/${item.contentId}` as any);
      return;
    }

    Alert.alert(item.title || "सूचना", item.body || "ई सूचना में कवनो लिंक नइखे।");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPadding + 8,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>🔔 आईल सूचना</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={[styles.desc, { color: colors.mutedForeground }]}>
          पिछला 30 दिन में आईल सब सूचना इहाँ देखीं
        </Text>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <Text style={[styles.stateText, { color: colors.mutedForeground }]}>
              सूचना लोड नइखे हो पावल।
            </Text>
            <TouchableOpacity
              onPress={() => void load()}
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.retryText}>फेरु कोशिश करीं</Text>
            </TouchableOpacity>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.centerState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={{ fontSize: 24 }}>🔔</Text>
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              अभी कवनो सूचना नइखे
            </Text>
            <Text style={[styles.stateText, { color: colors.mutedForeground }]}>
              नया सूचना आई त इहाँ पिछला 30 दिन तक देखाई दी।
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {items.map((item) => {
              const type = getNotificationType(item);
              const canOpen = Boolean(item.contentType && item.contentId);

              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => openNotification(item)}
                  activeOpacity={0.8}
                  style={[
                    styles.card,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={[styles.iconBox, { backgroundColor: "#FF6B0020" }]}>
                    <Feather name={type.icon} size={19} color={colors.primary} />
                  </View>

                  <View style={styles.itemBody}>
                    <View style={styles.itemTop}>
                      <Text
                        style={[styles.itemTitle, { color: colors.foreground }]}
                        numberOfLines={2}
                      >
                        {item.title || "हमार किस्सा"}
                      </Text>
                      {canOpen && (
                        <Feather name="chevron-right" size={19} color={colors.mutedForeground} />
                      )}
                    </View>

                    <Text
                      style={[styles.itemMessage, { color: colors.mutedForeground }]}
                      numberOfLines={3}
                    >
                      {item.body}
                    </Text>

                    <View style={styles.metaRow}>
                      <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                        {type.label}
                      </Text>
                      <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                        {formatNotificationDate(item.sentAt || item.scheduledAt)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "800" },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  desc: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  list: { gap: 10 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  itemBody: { flex: 1, minWidth: 0 },
  itemTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  itemTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  itemMessage: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 9,
  },
  meta: { fontSize: 10, fontWeight: "600" },
  centerState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
    gap: 10,
  },
  stateText: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  retryButton: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 4,
  },
  retryText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
