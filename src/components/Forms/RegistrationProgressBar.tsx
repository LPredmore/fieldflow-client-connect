import { Progress } from "@/components/ui/progress";

interface RegistrationProgressBarProps {
  currentStep: number;
  totalSteps: number;
  steps: string[];
}

export function RegistrationProgressBar({ currentStep, totalSteps, steps }: RegistrationProgressBarProps) {
  const progressPercentage = (currentStep / totalSteps) * 100;

  return (
    <div className="w-full space-y-4 mb-8">
      <div className="flex justify-between text-sm">
        {steps.map((step, index) => (
          <div
            key={step}
            className={`flex-1 text-center ${
              index + 1 === currentStep
                ? "text-primary font-medium"
                : index + 1 < currentStep
                ? "text-muted-foreground"
                : "text-muted-foreground/50"
            }`}
          >
            <div className="mb-2">
              <span
                className={`inline-flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                  index + 1 === currentStep
                    ? "border-primary bg-primary text-primary-foreground"
                    : index + 1 < currentStep
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/30"
                }`}
              >
                {index + 1}
              </span>
            </div>
            <div className="text-xs">{step}</div>
          </div>
        ))}
      </div>
      <Progress value={progressPercentage} className="h-2" />
    </div>
  );
}
