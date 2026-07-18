export function ProgressIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return <div className="mb-8"><div className="flex justify-between text-xs font-medium text-slate-400"><span>Step {currentStep} of {totalSteps}</span><span>{Math.round((currentStep / totalSteps) * 100)}% complete</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-300 transition-all duration-300" style={{ width: `${(currentStep / totalSteps) * 100}%` }} /></div></div>;
}
