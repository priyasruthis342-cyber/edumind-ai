import { useState } from 'react';
import { CheckCircle2, RotateCcw, Send, XCircle } from 'lucide-react';
import { useApp } from '@/context/useApp';
import { finishQuiz } from '@/lib/studyEvents';
import { buildQuiz, isFillCorrect, type QuizQuestion } from '@/lib/quizBuilder';
import type { Scan } from '@/types';
import { Chip, ErrorNotice, SectionHeading } from '@/components/ui';

type Answer = number | string;

interface QuizResult {
  score: number;
  total: number;
}

function isCorrect(question: QuizQuestion, answer: Answer | undefined): boolean {
  if (answer === undefined) return false;
  if (question.kind === 'mcq') return answer === question.answerIndex;
  return typeof answer === 'string' && isFillCorrect(question, answer);
}

function isAnswered(answer: Answer | undefined): boolean {
  if (answer === undefined) return false;
  return typeof answer === 'number' || answer.trim().length > 0;
}

export function QuizTab({ scan }: { scan: Scan }) {
  const { t } = useApp();
  const [quiz, setQuiz] = useState(() => buildQuiz(scan.raw_text));
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [unanswered, setUnanswered] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const questions = quiz.questions;
  const answeredCount = questions.filter((q) => isAnswered(answers[q.id])).length;

  if (!quiz.enoughMaterial) {
    return <ErrorNotice message={t('quizNotEnough')} />;
  }

  const restart = () => {
    setAnswers({});
    setUnanswered(false);
    setResult(null);
    setSaveError(null);
    setQuiz(buildQuiz(scan.raw_text));
  };

  const update = (questionId: string, value: Answer) => {
    if (result) return;
    setAnswers((current) => ({ ...current, [questionId]: value }));
    setUnanswered(false);
  };

  const submit = async () => {
    if (answeredCount < questions.length) {
      setUnanswered(true);
      return;
    }
    const score = questions.reduce((sum, q) => (isCorrect(q, answers[q.id]) ? sum + 1 : sum), 0);
    const total = questions.length;
    setResult({ score, total });
    setSaving(true);
    setSaveError(null);
    try {
      await finishQuiz({ scanId: scan.id, chapterTitle: scan.chapter_title, score, total });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('error'));
    } finally {
      setSaving(false);
    }
  };

  const percent = result ? Math.round((result.score / result.total) * 100) : 0;
  const message = percent === 100 ? t('quizPerfect') : percent >= 60 ? t('quizGood') : t('quizNeedsWork');

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading title={t('quizTitle')} subtitle={t('quizSub')} />
        <Chip tone="sky">{t('quizQuestionCount', { n: questions.length })}</Chip>
      </div>

      {result && (
        <div className="card relative overflow-hidden p-6 sm:p-8 animate-pop">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-pink-700">{t('quizScore')}</p>
              <p className="text-4xl font-semibold text-ink sm:text-5xl">
                {result.score}
                <span className="text-2xl text-stone-500"> / {result.total}</span>
              </p>
              <p className="mt-2 text-sm text-stone-700">{t('quizYourScore', { score: result.score, total: result.total })}</p>
              <p className="mt-1 text-sm font-semibold text-pink-900">{message}</p>
            </div>
            <button type="button" onClick={restart} className="btn-secondary shrink-0">
              <RotateCcw className="h-4 w-4" aria-hidden />
              {t('quizRetry')}
            </button>
          </div>
          {saving && <p className="mt-4 text-xs text-stone-600">{t('loading')}</p>}
          {saveError && (
            <div className="mt-4">
              <ErrorNotice message={saveError} />
            </div>
          )}
        </div>
      )}

      {unanswered && !result && <ErrorNotice message={t('quizUnanswered')} />}

      <ol className="space-y-4">
        {questions.map((question, index) => {
          const answer = answers[question.id];
          const correct = result !== null && isCorrect(question, answer);
          return (
            <li key={question.id} className="card space-y-4 p-5 sm:p-6">
              <p className="flex gap-3 text-base font-semibold leading-relaxed text-ink">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pink-600 text-xs font-bold text-white">
                  {index + 1}
                </span>
                <span>{question.prompt}</span>
              </p>

              {question.kind === 'mcq' ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {question.options.map((option, optionIndex) => {
                    const selected = answer === optionIndex;
                    const isKey = optionIndex === question.answerIndex;
                    let tone = 'border-stone-200 bg-surface text-stone-800 hover:border-pink-400 hover:bg-pink-50';
                    if (selected && !result) tone = 'border-pink-600 bg-pink-50 text-pink-950 ring-2 ring-pink-500';
                    if (result && isKey) tone = 'border-green-500 bg-green-50 text-green-950';
                    if (result && selected && !isKey) tone = 'border-rose-400 bg-rose-50 text-rose-950';
                    return (
                      <button
                        key={optionIndex}
                        type="button"
                        disabled={result !== null}
                        onClick={() => update(question.id, optionIndex)}
                        className={`flex items-start gap-3 rounded-xl border p-3 text-left text-sm leading-relaxed transition duration-200 disabled:cursor-default ${tone}`}
                      >
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                          {result && isKey && <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden />}
                          {result && selected && !isKey && <XCircle className="h-5 w-5 text-rose-600" aria-hidden />}
                          {!result && (
                            <span className={`h-4 w-4 rounded-full border-2 ${selected ? 'border-pink-600 bg-pink-600' : 'border-stone-400'}`} />
                          )}
                        </span>
                        {option}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={typeof answer === 'string' ? answer : ''}
                    disabled={result !== null}
                    onChange={(event) => update(question.id, event.target.value)}
                    placeholder={t('quizFillPlaceholder')}
                    aria-label={question.prompt}
                    className={`input ${result ? (correct ? 'border-green-500 bg-green-50' : 'border-rose-400 bg-rose-50') : ''}`}
                  />
                </div>
              )}

              {result && !correct && (
                <p className="text-xs font-semibold text-green-800">
                  {t('correctAnswer')}: {question.kind === 'mcq' ? question.options[question.answerIndex] : question.answer}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {!result && (
        <div className="sticky bottom-4 flex flex-col gap-3 rounded-2xl bg-surface/95 p-4 shadow-lift ring-1 ring-stone-200 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-stone-700">
            {t('quizAnsweredCount', { answered: answeredCount, total: questions.length })}
          </p>
          <button type="button" onClick={() => void submit()} className="btn-primary">
            <Send className="h-4 w-4" aria-hidden />
            {t('quizSubmit')}
          </button>
        </div>
      )}
    </section>
  );
}
