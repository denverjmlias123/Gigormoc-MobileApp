import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../theme';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

interface SkillRow {
  id: string;
  name: string;
  category_id: string;
}

export default function OnboardingStep2SkillsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { signOut } = useAuth();

  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchSkills = async () => {
      try {
        const { data, error } = await supabase
          .from('skills')
          .select('id, name, category_id')
          .eq('is_active', true);

        if (!error && data && mounted) {
          setSkills(data);
        }
      } catch {
        // Table may not exist yet in Milestone 1 (added in Milestone 2)
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchSkills();
    return () => {
      mounted = false;
    };
  }, []);

  const toggleSkill = (id: string) => {
    setSelectedSkills((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleContinue = () => {
    // Proceed to step 3
    router.push('/(onboarding)/step3-profile');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <Text style={[styles.stepIndicator, { color: theme.colors.muted }]}>Onboarding 2 of 3</Text>
          <TouchableOpacity onPress={() => signOut().then(() => router.replace('/(auth)/login'))}>
            <Text style={{ color: theme.colors.primary, fontSize: 14, fontWeight: '600' }}>Log Out</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.title, { color: theme.colors.text }]}>Select Your Skills</Text>
        <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
          Highlight what services you offer to help clients discover you.
        </Text>
      </View>

      <View style={styles.body}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : skills.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              No skills catalog available yet
            </Text>
            <Text style={[styles.emptyDesc, { color: theme.colors.muted }]}>
              The administrator has not published skills categories to the database yet. You can add your skills later directly from your profile.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.skillsGrid}>
            {skills.map((skill) => {
              const selected = selectedSkills.includes(skill.id);
              return (
                <TouchableOpacity
                  key={skill.id}
                  style={[
                    styles.chip,
                    { borderColor: theme.colors.border },
                    selected && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                  ]}
                  onPress={() => toggleSkill(skill.id)}
                >
                  <Text style={[styles.chipText, selected && { color: '#ffffff' }]}>
                    {skill.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
          onPress={handleContinue}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleContinue}
        >
          <Text style={{ color: theme.colors.muted, textAlign: 'center' }}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
    paddingTop: 48,
  },
  header: {
    marginBottom: 16,
  },
  stepIndicator: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    padding: 20,
    backgroundColor: '#F4F7FC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE4F2',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
  },
  footer: {
    marginTop: 20,
    marginBottom: 10,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    marginTop: 16,
    padding: 8,
  },
});
