export function partialOutreach(business) {
  const queries = business.ai?.queries || [];
  const completed = queries.filter(q => q.status === 'tested');
  const mentions = completed.filter(q => q.mentioned).length;
  const subject = `Local search visibility for ${business.name}`;
  const observation = completed.length
    ? `In a partial check of ${completed.length} customer queries using the Gemini API, ${business.name} was named in ${mentions} responses. The remaining checks did not complete, so this is an incomplete snapshot, not a full assessment.`
    : `We would like to explore how customers find ${business.name} through local search and AI recommendations. Our automated checks did not complete, so we do not yet have AI visibility findings to share.`;
  const body = `Hi team at ${business.name},\n\n${observation}\n\nWould you be open to a short conversation about your local search goals and whether there is room to improve visibility?\n\nBest,\n[Your name]\n[Your agency]`;
  return { subject, body, outreach: `Subject: ${subject}\n\n${body}`,
    evidence_note: `${completed.length} completed Gemini checks; incomplete checks are excluded. Draft available despite scan failures.` };
}
