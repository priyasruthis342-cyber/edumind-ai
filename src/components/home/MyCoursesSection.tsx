import { ArrowRight, BookOpen, Camera } from 'lucide-react';
import { useApp } from '@/context/useApp';
import { ErrorNotice } from '@/components/ui';

export function MyCoursesSection({
  onStartScanner,
  error,
}: {
  onStartScanner: (course: string) => void;
  error: string | null;
}) {
  const { courses } = useApp();

  return (
    <section id="my-courses" className="scroll-mt-28 space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-ink sm:text-3xl">My Courses</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-stone-700">
          Courses and exams you pick below are saved here. Open one to scan its notes.
        </p>
      </div>

      {error && <ErrorNotice message={error} />}

      {courses.length === 0 ? (
        <div className="card flex flex-col items-start gap-3 border-dashed p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-stone-100 text-stone-700">
              <BookOpen className="h-5 w-5" aria-hidden />
            </span>
            <p className="text-sm text-stone-700">You have not picked a course yet. Choose one from the list below.</p>
          </div>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <li key={course.id} className="card flex flex-col gap-4 p-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-lift">
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-800">{course.category}</p>
                <p className="text-base font-semibold text-ink">{course.course_name}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => onStartScanner(course.course_name)} className="btn-primary !py-2.5 text-xs">
                  <Camera className="h-3.5 w-3.5" aria-hidden />
                  Scan notes
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
