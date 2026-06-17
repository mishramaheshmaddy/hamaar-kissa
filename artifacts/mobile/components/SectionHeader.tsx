import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface SectionHeaderProps {
  title: string;
  onSeeAll?: () => void;
}

export default function SectionHeader({ title, onSeeAll }: SectionHeaderProps) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      <View style={[styles.accent, { backgroundColor: colors.primary }]} />
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      {onSeeAll && (
        <TouchableOpacity style={styles.seeAll} onPress={onSeeAll}>
          <Text style={[styles.seeAllText, { color: colors.primary }]}>सब देखीं</Text>
          <Feather name="chevron-right" size={14} color={colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  accent: {
    width: 4,
    height: 20,
    borderRadius: 2,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
  },
  seeAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
