// Generated from FastAPI. Run npm run contract:generate; do not edit.
export interface paths {
    "/api/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Me
         * @description Protected test endpoint: echoes the user id from the verified token.
         */
        get: operations["me_api_me_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/profile": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Profile */
        get: operations["get_profile_api_profile_get"];
        /** Put Profile */
        put: operations["put_profile_api_profile_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/experiments/propose": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Propose Experiment */
        post: operations["propose_experiment_api_experiments_propose_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/experiments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Experiments */
        get: operations["list_experiments_api_experiments_get"];
        put?: never;
        /** Save Experiment */
        post: operations["save_experiment_api_experiments_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/experiments/{experiment_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Experiment */
        get: operations["get_experiment_api_experiments__experiment_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/experiments/{experiment_id}/start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Start Experiment */
        post: operations["start_experiment_api_experiments__experiment_id__start_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/experiments/{experiment_id}/checkins": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Checkins
         * @description All check-ins for an owned experiment, oldest day first.
         */
        get: operations["list_checkins_api_experiments__experiment_id__checkins_get"];
        put?: never;
        /**
         * Submit Checkin
         * @description Submit today's check-in, or replace it if one already exists for today.
         */
        post: operations["submit_checkin_api_experiments__experiment_id__checkins_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/experiments/{experiment_id}/complete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Complete Experiment
         * @description Run the deterministic analysis, save the report, and mark the experiment completed.
         *
         *     The AI-written part is added afterwards by POST /report, so completing stays fast
         *     and never depends on the AI service.
         */
        post: operations["complete_experiment_api_experiments__experiment_id__complete_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/experiments/{experiment_id}/report": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Report
         * @description The Lab Report: analysis, chart data, and the written narrative once it exists.
         */
        get: operations["get_report_api_experiments__experiment_id__report_get"];
        put?: never;
        /**
         * Write Report
         * @description Have the reasoning model explain the stored analysis, and save it on the report.
         *
         *     Idempotent: if the narrative already exists it is returned without calling the model,
         *     unless ?regenerate=true. The analysis itself is never touched.
         */
        post: operations["write_report_api_experiments__experiment_id__report_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/demo/reset": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reset Demo
         * @description Create or reset the signed-in user's seeded demo experiment and return its Lab Report.
         */
        post: operations["reset_demo_api_demo_reset_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Health */
        get: operations["health_health_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health/supabase": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Health Supabase */
        get: operations["health_supabase_health_supabase_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** Adherence */
        Adherence: {
            /** Baseline Days Planned */
            baseline_days_planned: number;
            /** Baseline Days Logged */
            baseline_days_logged: number;
            /** Intervention Days Planned */
            intervention_days_planned: number;
            /** Intervention Days Logged */
            intervention_days_logged: number;
            /** Intervention Days Completed */
            intervention_days_completed: number;
            /** Adherence Rate */
            adherence_rate?: number | null;
            /** Coverage Rate */
            coverage_rate: number;
            /** Missing Days */
            missing_days: number[];
        };
        /** Analysis */
        Analysis: {
            /** Primary Metric */
            primary_metric: string;
            /** Success Criteria Percent */
            success_criteria_percent: number;
            adherence: components["schemas"]["Adherence"];
            /** Metrics */
            metrics: components["schemas"]["MetricAnalysis"][];
            prediction?: components["schemas"]["PredictionComparison"] | null;
            signal: components["schemas"]["Signal"];
        };
        /** ChartData */
        ChartData: {
            primary_metric: components["schemas"]["ChartMetric"];
            /** Metrics */
            metrics: components["schemas"]["ChartMetric"][];
            /** Baseline Days */
            baseline_days: number;
            /** Intervention Days */
            intervention_days: number;
            /** Points */
            points: components["schemas"]["ChartPoint"][];
            /** Baseline Mean */
            baseline_mean?: number | null;
            /** Intervention Mean */
            intervention_mean?: number | null;
            predicted_band?: components["schemas"]["PredictedBand"] | null;
        };
        /** ChartMetric */
        ChartMetric: {
            /** Key */
            key: string;
            /** Label */
            label: string;
            /** Type */
            type: string;
            /** Min */
            min?: number | null;
            /** Max */
            max?: number | null;
        };
        /** ChartPoint */
        ChartPoint: {
            /** Day */
            day: number;
            /** Phase */
            phase: string;
            /** Logged */
            logged: boolean;
            /** Intervention Completed */
            intervention_completed?: boolean | null;
            /** Value */
            value?: number | null;
            /** Values */
            values?: {
                [key: string]: boolean | number;
            } | null;
            /** Note */
            note?: string | null;
        };
        /**
         * CheckinIn
         * @description Today's check-in. No day, phase, experiment or user id: the backend derives them.
         */
        CheckinIn: {
            /** Intervention Completed */
            intervention_completed?: boolean | null;
            /** Metric Values */
            metric_values: {
                [key: string]: boolean | number;
            };
            /** Note */
            note?: string | null;
        };
        /** CheckinOut */
        CheckinOut: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Experiment Id
             * Format: uuid
             */
            experiment_id: string;
            /**
             * Phase
             * @enum {string}
             */
            phase: "baseline" | "intervention";
            /** Day Number */
            day_number: number;
            /** Intervention Completed */
            intervention_completed: boolean;
            /** Metric Values */
            metric_values: {
                [key: string]: boolean | number;
            };
            /** Note */
            note: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /** Classification */
        Classification: {
            /**
             * Category
             * @enum {string}
             */
            category: "sleep" | "energy" | "focus" | "exercise" | "nutrition" | "stress" | "routine" | "other";
            /**
             * Intent
             * @enum {string}
             */
            intent: "behavior_change" | "goal" | "question" | "other";
            /**
             * Risk
             * @enum {string}
             */
            risk: "low" | "review" | "blocked";
        };
        /**
         * DemoResetRequest
         * @description Empty on purpose: the user comes from the verified token, never from the body.
         */
        DemoResetRequest: Record<string, never>;
        /**
         * ExperimentOut
         * @description A saved experiment. profile_id is deliberately not exposed.
         */
        ExperimentOut: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Status
             * @enum {string}
             */
            status: "draft" | "proposed" | "active" | "completed";
            /** Question */
            question: string;
            /**
             * Category
             * @enum {string}
             */
            category: "sleep" | "energy" | "focus" | "exercise" | "nutrition" | "stress" | "routine" | "other";
            /** Hypothesis */
            hypothesis: string;
            intervention: components["schemas"]["Intervention"];
            /** Baseline Days */
            baseline_days: number;
            /** Intervention Days */
            intervention_days: number;
            /** Metrics */
            metrics: components["schemas"]["Metric"][];
            success_criteria: components["schemas"]["SuccessCriteria"];
            prediction: components["schemas"]["Prediction"];
            /** Started At */
            started_at: string | null;
            /** Completed At */
            completed_at: string | null;
            /** Is Seeded */
            is_seeded: boolean;
            progress: components["schemas"]["ExperimentProgress"];
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /**
         * ExperimentProgress
         * @description Where an experiment is right now. Computed on read, never stored.
         */
        ExperimentProgress: {
            /**
             * State
             * @enum {string}
             */
            state: "not_started" | "in_progress" | "ended" | "completed";
            /** Day Number */
            day_number?: number | null;
            /** Phase */
            phase?: ("baseline" | "intervention") | null;
            /** Phase Day */
            phase_day?: number | null;
            /** Phase Days */
            phase_days?: number | null;
            /** Total Days */
            total_days: number;
            /** Days Remaining */
            days_remaining?: number | null;
            /** Started At */
            started_at?: string | null;
            /** Ends At */
            ends_at?: string | null;
        };
        /** ExperimentProposal */
        ExperimentProposal: {
            /** Question */
            question: string;
            /** Hypothesis */
            hypothesis: string;
            intervention: components["schemas"]["Intervention"];
            /** Baseline Days */
            baseline_days: number;
            /** Intervention Days */
            intervention_days: number;
            /** Metrics */
            metrics: components["schemas"]["Metric"][];
            success_criteria: components["schemas"]["SuccessCriteria"];
        };
        /** HTTPValidationError */
        HTTPValidationError: {
            /** Detail */
            detail?: components["schemas"]["ValidationError"][];
        };
        /** Intervention */
        Intervention: {
            /** Action */
            action: string;
            /** Timing */
            timing: string;
            /** Frequency */
            frequency: string;
        };
        /**
         * LabReport
         * @description Everything the Lab Report screen needs, in one response.
         */
        LabReport: {
            experiment: components["schemas"]["ExperimentOut"];
            analysis: components["schemas"]["Analysis"];
            narrative?: components["schemas"]["ReportNarrative"] | null;
            chart: components["schemas"]["ChartData"];
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
        };
        /** Metric */
        Metric: {
            /** Key */
            key: string;
            /** Label */
            label: string;
            /**
             * Type
             * @enum {string}
             */
            type: "scale" | "number" | "boolean" | "duration";
            /** Min */
            min: number | null;
            /** Max */
            max: number | null;
            /** Primary */
            primary: boolean;
        };
        /** MetricAnalysis */
        MetricAnalysis: {
            /** Key */
            key: string;
            /** Label */
            label: string;
            /** Type */
            type: string;
            /** Primary */
            primary: boolean;
            baseline: components["schemas"]["PhaseStats"];
            intervention: components["schemas"]["PhaseStats"];
            /** Absolute Change */
            absolute_change?: number | null;
            /** Percent Change */
            percent_change?: number | null;
            /** Median Change Percent */
            median_change_percent?: number | null;
            /** Pooled Sd */
            pooled_sd?: number | null;
            /** Effect Size */
            effect_size?: number | null;
            /** Direction Consistency */
            direction_consistency?: number | null;
            /**
             * Outliers
             * @default []
             */
            outliers: components["schemas"]["Outlier"][];
        };
        /** NextExperiment */
        NextExperiment: {
            /** Question */
            question: string;
            /** Reason */
            reason: string;
        };
        /** Outlier */
        Outlier: {
            /**
             * Phase
             * @enum {string}
             */
            phase: "baseline" | "intervention";
            /** Day Number */
            day_number: number;
            /** Value */
            value: number;
        };
        /** PhaseStats */
        PhaseStats: {
            /** N */
            n: number;
            /** Mean */
            mean?: number | null;
            /** Median */
            median?: number | null;
            /** Sd */
            sd?: number | null;
        };
        /** PredictedBand */
        PredictedBand: {
            /** Min Percent */
            min_percent: number;
            /** Max Percent */
            max_percent: number;
            /** Midpoint Percent */
            midpoint_percent: number;
            /** Expected Value Min */
            expected_value_min: number;
            /** Expected Value Max */
            expected_value_max: number;
        };
        /** Prediction */
        Prediction: {
            /** Target Metric */
            target_metric: string;
            /**
             * Direction
             * @enum {string}
             */
            direction: "increase" | "decrease" | "no_change";
            /** Expected Change Min */
            expected_change_min: number;
            /** Expected Change Max */
            expected_change_max: number;
            /**
             * Confidence
             * @enum {string}
             */
            confidence: "low" | "moderate" | "high";
            /** Reasoning */
            reasoning: string;
            /** Uncertainty Factors */
            uncertainty_factors: string[];
        };
        /** PredictionComparison */
        PredictionComparison: {
            /**
             * Predicted Direction
             * @enum {string}
             */
            predicted_direction: "increase" | "decrease" | "no_change";
            /** Predicted Min */
            predicted_min: number;
            /** Predicted Max */
            predicted_max: number;
            /** Predicted Midpoint */
            predicted_midpoint: number;
            /** Observed Change Percent */
            observed_change_percent: number;
            /** Error Points */
            error_points: number;
            /** Within Predicted Range */
            within_predicted_range: boolean;
            /** Direction Correct */
            direction_correct: boolean;
            /** Accuracy Percent */
            accuracy_percent: number;
        };
        /**
         * ProfileIn
         * @description PUT body. No user_id: the user comes from the verified token.
         */
        ProfileIn: {
            /**
             * Age Range
             * @enum {string}
             */
            age_range: "18-24" | "25-34" | "35-44" | "45-54" | "55-64" | "65+";
            /** Usual Sleep Hours */
            usual_sleep_hours: number;
            usual_sleep_schedule: components["schemas"]["SleepSchedule"];
            /**
             * Activity Level
             * @enum {string}
             */
            activity_level: "sedentary" | "lightly_active" | "moderately_active" | "very_active";
            /** Goals */
            goals: string[];
            /** Regular Habits */
            regular_habits: string[];
            /** Constraints */
            constraints: string[];
        };
        /** ProfileOut */
        ProfileOut: {
            /**
             * Age Range
             * @enum {string}
             */
            age_range: "18-24" | "25-34" | "35-44" | "45-54" | "55-64" | "65+";
            /** Usual Sleep Hours */
            usual_sleep_hours: number;
            usual_sleep_schedule: components["schemas"]["SleepSchedule"];
            /**
             * Activity Level
             * @enum {string}
             */
            activity_level: "sedentary" | "lightly_active" | "moderately_active" | "very_active";
            /** Goals */
            goals: string[];
            /** Regular Habits */
            regular_habits: string[];
            /** Constraints */
            constraints: string[];
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /**
         * ProposeRequest
         * @description No user_id: the user comes from the verified token.
         */
        ProposeRequest: {
            /** Question */
            question: string;
        };
        /** ProposeResponse */
        ProposeResponse: {
            proposal?: components["schemas"]["ExperimentProposal"] | null;
            prediction?: components["schemas"]["Prediction"] | null;
            safety: components["schemas"]["SafetyDecision"];
            classification: components["schemas"]["Classification"];
        };
        /**
         * ReportNarrative
         * @description The AI-written part of the Lab Report, as stored and returned.
         *
         *     Deliberately plain: it is read back from the database, and rows written under older
         *     generation rules must keep loading. The strict rules live on NarrativeDraft.
         */
        ReportNarrative: {
            /** Summary */
            summary: string;
            /** Interpretation */
            interpretation: string;
            /** Personal Learnings */
            personal_learnings: string[];
            /** Confounders */
            confounders: string[];
            next_experiment: components["schemas"]["NextExperiment"];
        };
        /** SafetyDecision */
        SafetyDecision: {
            /** Allowed */
            allowed: boolean;
            /** Reason */
            reason?: string | null;
            /** Suggested Alternative */
            suggested_alternative?: string | null;
        };
        /**
         * SaveExperimentRequest
         * @description Body for saving what /propose returned. No user_id or profile_id: both come from the token.
         */
        SaveExperimentRequest: {
            proposal: components["schemas"]["ExperimentProposal"];
            prediction: components["schemas"]["Prediction"];
            /**
             * Category
             * @enum {string}
             */
            category: "sleep" | "energy" | "focus" | "exercise" | "nutrition" | "stress" | "routine" | "other";
        };
        /** Signal */
        Signal: {
            /**
             * Classification
             * @enum {string}
             */
            classification: "likely_signal" | "possible_signal" | "unclear" | "probably_noise";
            /** Reasons */
            reasons: string[];
            /** Success Criteria Met */
            success_criteria_met: boolean;
            /** Matches Predicted Direction */
            matches_predicted_direction: boolean;
        };
        /** SleepSchedule */
        SleepSchedule: {
            /** Bedtime */
            bedtime: string;
            /** Wake Time */
            wake_time: string;
        };
        /** SuccessCriteria */
        SuccessCriteria: {
            /** Primary Metric */
            primary_metric: string;
            /** Minimum Change Percent */
            minimum_change_percent: number;
        };
        /** ValidationError */
        ValidationError: {
            /** Location */
            loc: (string | number)[];
            /** Message */
            msg: string;
            /** Error Type */
            type: string;
            /** Input */
            input?: unknown;
            /** Context */
            ctx?: Record<string, never>;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    me_api_me_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: string;
                    };
                };
            };
        };
    };
    get_profile_api_profile_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProfileOut"];
                };
            };
        };
    };
    put_profile_api_profile_put: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProfileIn"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProfileOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    propose_experiment_api_experiments_propose_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProposeRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProposeResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_experiments_api_experiments_get: {
        parameters: {
            query?: {
                status?: ("draft" | "proposed" | "active" | "completed") | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExperimentOut"][];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    save_experiment_api_experiments_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SaveExperimentRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExperimentOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_experiment_api_experiments__experiment_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                experiment_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExperimentOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    start_experiment_api_experiments__experiment_id__start_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                experiment_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExperimentOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_checkins_api_experiments__experiment_id__checkins_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                experiment_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CheckinOut"][];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    submit_checkin_api_experiments__experiment_id__checkins_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                experiment_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CheckinIn"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CheckinOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    complete_experiment_api_experiments__experiment_id__complete_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                experiment_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LabReport"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_report_api_experiments__experiment_id__report_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                experiment_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LabReport"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    write_report_api_experiments__experiment_id__report_post: {
        parameters: {
            query?: {
                regenerate?: boolean;
            };
            header?: never;
            path: {
                experiment_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LabReport"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    reset_demo_api_demo_reset_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["DemoResetRequest"] | null;
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LabReport"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    health_health_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: string;
                    };
                };
            };
        };
    };
    health_supabase_health_supabase_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: string;
                    };
                };
            };
        };
    };
}
