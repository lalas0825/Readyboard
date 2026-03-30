// This file exists because expo/AppEntry.js looks for ../../App
// when expo is hoisted to monorepo root in npm workspaces.
// It simply re-exports expo-router's entry point.
import 'expo-router/entry';
