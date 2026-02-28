#!/usr/bin/env node

/**
 * Export TypeScript concepts to JSON for Python service
 * Converts versailles.ts concept data to a format Python can consume
 */

const fs = require('fs');
const path = require('path');

// Import concepts from versailles.ts
// Note: This requires the TypeScript to be transpiled or using ts-node
// For simplicity, we'll use a direct approach by reading and parsing

const conceptsPath = path.join(__dirname, '../src/data/versailles.ts');
const outputPath = path.join(__dirname, '../python/data/versailles.json');

// Read the TypeScript file
const tsContent = fs.readFileSync(conceptsPath, 'utf8');

// Extract the concepts array using regex
// This is a simple approach - assumes the format is consistent
const match = tsContent.match(/export const concepts: Concept\[\] = (\[[\s\S]*?\]);/);

if (!match) {
  console.error('Failed to extract concepts array from versailles.ts');
  process.exit(1);
}

// Parse the concepts array
// We need to evaluate it as JavaScript
// Remove TypeScript type annotations and eval
let conceptsStr = match[1];

// Simple cleanup for JS evaluation
// This is hacky but works for our specific format
const concepts = eval(conceptsStr);

// Write to JSON
fs.writeFileSync(outputPath, JSON.stringify(concepts, null, 2));

console.log(`✓ Exported ${concepts.length} concepts to ${outputPath}`);
console.log(`  Languages: ${Object.keys(concepts[0].position).join(', ')}`);
console.log(`  Clusters: ${[...new Set(concepts.map(c => c.cluster))].join(', ')}`);
