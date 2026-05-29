import React, { useState } from "react";
import styles from "./BotInterface.module.css";
import { auth } from "@/lib/firebase";
import { saveDialogueFlow } from "@/app/actions/user";
import { DialogueStep } from "@/hooks/useStoryEngine";

const FLOW_ID = "main";

export function WriterPanel({
  flowSteps,
  setFlowSteps,
  onClose
}: {
  flowSteps: DialogueStep[];
  setFlowSteps: React.Dispatch<React.SetStateAction<DialogueStep[]>>;
  onClose: () => void;
}) {
  const [editableSteps, setEditableSteps] = useState<DialogueStep[]>(JSON.parse(JSON.stringify(flowSteps)));
  const [writerSaving, setWriterSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSaveFlow = async () => {
    if (writerSaving) return;
    setWriterSaving(true);
    try {
      await saveDialogueFlow(editableSteps, auth.currentUser?.uid);
      setFlowSteps(editableSteps);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWriterSaving(false);
    }
  };

  const updateStep = (idx: number, updates: Partial<DialogueStep>) =>
    setEditableSteps(prev => prev.map((s, i) => i === idx ? { ...s, ...updates } : s));

  const updateOption = (si: number, oi: number, val: string) =>
    setEditableSteps(prev => prev.map((s, i) => {
      if (i !== si) return s;
      const opts = [...s.options]; opts[oi] = val; return { ...s, options: opts };
    }));

  const addOption = (si: number) =>
    setEditableSteps(prev => prev.map((s, i) =>
      i === si ? { ...s, options: [...s.options, ""] } : s
    ));

  const removeOption = (si: number, oi: number) =>
    setEditableSteps(prev => prev.map((s, i) =>
      i === si ? { ...s, options: s.options.filter((_, j) => j !== oi) } : s
    ));

  const addStep = () =>
    setEditableSteps(prev => [...prev, {
      id: `step_${Date.now()}`,
      ai: "",
      options: [""],
      type: "row" as const,
    }]);

  const removeStep = (idx: number) =>
    setEditableSteps(prev => prev.filter((_, i) => i !== idx));

  return (
    <div className={styles.writerOverlay}>
      <div className={styles.writerPanel}>
        <div className={styles.writerHeader}>
          <span className={styles.writerTitle}>Writer Mode</span>
          <div className={styles.writerHeaderActions}>
            <button className={styles.writerSaveBtn} onClick={handleSaveFlow} disabled={writerSaving}>
              {writerSaving ? "Saving…" : "Save Flow"}
            </button>
            <button className={styles.writerCloseBtn} onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        {error && <div style={{ color: "red", padding: "10px" }}>{error}</div>}

        <div className={styles.writerStepList}>
          {editableSteps.map((s, si) => (
            <div key={s.id} className={styles.writerStepCard}>
              <div className={styles.writerStepMeta}>
                <span className={styles.writerStepNum}>Step {si + 1}</span>
                <div className={styles.writerTypeToggle}>
                  <button
                    className={`${styles.writerTypeBtn} ${s.type === "row" ? styles.writerTypeBtnActive : ""}`}
                    onClick={() => updateStep(si, { type: "row" })}
                  >Row</button>
                  <button
                    className={`${styles.writerTypeBtn} ${s.type === "grid" ? styles.writerTypeBtnActive : ""}`}
                    onClick={() => updateStep(si, { type: "grid" })}
                  >Grid</button>
                </div>
                <button
                  className={styles.writerDeleteStep}
                  onClick={() => removeStep(si)}
                  aria-label="Delete step"
                  disabled={editableSteps.length <= 1}
                >✕</button>
              </div>

              <textarea
                className={styles.writerAiTextarea}
                value={s.ai}
                onChange={e => updateStep(si, { ai: e.target.value })}
                placeholder="AI message for this step…"
                rows={3}
              />

              <div className={styles.writerOptions}>
                {s.options.map((opt, oi) => (
                  <div key={oi} className={styles.writerOptionRow}>
                    <input
                      className={styles.writerOptionInput}
                      value={opt}
                      onChange={e => updateOption(si, oi, e.target.value)}
                      placeholder={`Option ${oi + 1}`}
                    />
                    <button
                      className={styles.writerRemoveOption}
                      onClick={() => removeOption(si, oi)}
                      disabled={s.options.length <= 1}
                      aria-label="Remove option"
                    >−</button>
                  </div>
                ))}
                <button className={styles.writerAddOption} onClick={() => addOption(si)}>
                  + Option
                </button>
              </div>
            </div>
          ))}
        </div>

        <button className={styles.writerAddStep} onClick={addStep}>
          + Add Step
        </button>
      </div>
    </div>
  );
}
