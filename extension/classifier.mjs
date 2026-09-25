export const categories = ['Work / Product', 'Work / Analytics', 'Research / Robotics', 'Research / AI & ML', 'Research / Papers', 'Education / Applications', 'Development', 'Learning', 'Misc'];
// First match wins, so more specific rules come first.
const rules = [
  ['Education / Applications', /\b(phd|doctoral|doctorate|scholarship|admissions|dissertation)\b/i],
  ['Research / Robotics', /\b(robotics?|slam|ros2?|lidar|odometry|autonomous)\b/i],
  ['Research / AI & ML', /\b(machine learning|deep learning|neural|llm|pytorch|tensorflow|huggingface|artificial intelligence)\b/i],
  ['Work / Analytics', /\b(analytics|tableau|powerbi|metabase|amplitude|mixpanel)\b/i],
  ['Work / Product', /\b(figma|product management|roadmap|ux|design system|jira)\b/i],
  ['Research / Papers', /\b(arxiv|doi|pubmed|paper|journal|ieee|researchgate|scholar)\b/i],
  ['Development', /\b(github|gitlab|stackoverflow|developer|documentation|npmjs|docker|programming|localhost)\b/i],
  ['Learning', /\b(coursera|udemy|edx|tutorial|course|learn|learning|khanacademy)\b/i]
];
export function classify(bookmark) {
  let host = '';
  try { host = new URL(bookmark.url).hostname; } catch {}
  const input = `${bookmark.title} ${host} ${bookmark.path || ''}`;
  for (const [category, pattern] of rules) {
    const match = input.match(pattern);
    if (match) return {category, reason: `Matched: ${match[0]}`};
  }
  return {category: 'Misc', reason: 'No local rule matched — review manually'};
}
export function flatten(tree) {
  const result = [];
  function visit(node, path = [], locked = false) {
    locked ||= !!node.unmodifiable;
    if (node.url) { if (!locked) result.push({...node, path: path.join(' / ')}); }
    else for (const child of node.children || []) visit(child, node.title ? [...path, node.title] : path, locked);
  }
  tree.forEach(n => visit(n));
  return result;
}
