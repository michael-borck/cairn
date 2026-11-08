# Cognitive Foraging and the Wayfinder Controller: An Architectural Blueprint for Multi-Scale Adaptive Instructional Systems

Designing a next-generation adaptive learning engine requires moving
beyond the conventional \"curriculum with a difficulty dial\" to model
the learner as a **cognitive forager** navigating a dynamic knowledge
landscape under a multi-timescale controller called **Wayfinder**^1^.
Historically, adaptive instructional technologies evolved along four
largely separate tracks: psychometric item selection via Computerized
Adaptive Testing (CAT) and Item Response Theory (IRT)^5^, step-level
cognitive diagnosis in Intelligent Tutoring Systems (ITS) via Bayesian
Knowledge Tracing (BKT) and Performance Factors Analysis (PFA)^7^,
combinatorial prerequisite mapping via Knowledge Space Theory (KST)^9^,
and memory scheduling via spaced repetition queues^5^. While each
lineage solves a localized estimation problem, production engines almost
universally collapse instructional policy into a single myopic rule:
picking the next item to target a fixed probability of correctness, such
as the 85% accuracy sweet spot derived for gradient-descent binary
classifiers^12^. Consequently, existing systems answer only what a
learner is ready to attempt next^9^. They lack a unified formal
mechanism to decide when a skill patch has yielded diminishing returns,
when a persistent error reflects a structured misconception rather than
random noise, when to shift the learner\'s cognitive role, or whether
apparent mastery transfers to novel contexts^14^.

**Cognitive Foraging** and the **Wayfinder** controller unify these
disconnected mechanisms by synthesizing principles from optimal foraging
ecology^1^, partially observable optimal control^3^, Bayesian
experimental design^20^, statistical physics^22^, immunology^15^,
cognitive apprenticeship^16^, and real options economics^4^. Instead of
maximizing immediate item correctness, Wayfinder maintains a
multi-dimensional distributional learner model and plans short
trajectories across four nested timescales (Micro, Meso, Macro, and
Meta) to maximize **Expected Transferable Learning per Unit of Attention
(ETL/UA)** subject to lexicographic safety, due-review, and prerequisite
readiness constraints^4^. Within this framework, spaced repetition is no
longer an external scheduler fighting the mastery model; it is modeled
organically as ecological patch regeneration^1^. Similarly, scalar
difficulty sliders are replaced by a **Productive Surprise** diagnostic
regime that uses response accuracy, metacognitive confidence, and
latency together to distinguish cognitive overload from high-confidence
misconceptions^4^.

In Monte Carlo simulation benchmarks across five synthetic learner
archetypes---calibrated learners, overconfident misconception-prone
learners, wheel-spinners, underconfident hint-abusers, and rapid
forgetters---a deterministic 3-step lookahead Wayfinder controller
(Wayfinder_MPC_3Step) outperforms classical BKT with SuperMemo-2
scheduling (BKT_Threshold_SM2) and scalar 85%-accuracy IRT controllers
(IRT_85_Rule) by 2.56x on 14-day delayed mastery (0.4174 vs. 0.1628) and
by 7.81x on novel-context transfer (0.3826 vs. 0.0490), while reducing
unproductive wheel-spinning from 90.00% of instructional steps to
17.04%^4^. Crucially, this architecture does not require opaque deep
reinforcement learning or neural knowledge tracing to launch; its
first-generation implementation (Wayfinder v1) is deterministic,
auditable, and explainable, confining Large Language Models (LLMs)
strictly to accountable content and hint generation while retaining
policy authority inside the controller^4^.

## 1. Taxonomy of the Adaptive Landscape & Architecture Synthesis

The nomenclature of adaptive education reflects distinct research,
standards, and commercial communities, each contributing a partial
module to the end-to-end instructional pipeline. Mapping how these
lineages connect---from item calibration through to path
selection---clarifies why conventional architectures suffer from policy
drift and how Cognitive Foraging unifies them.

### 1.1 Nomenclature across Research, Standards, and Industry Lineages

Across academic conferences (AI in Education \[AIED\], Educational Data
Mining \[EDM\], Learning Analytics and Knowledge \[LAK\]), standards
bodies (IEEE Learning Engineering), and commercial product ecosystems,
terminology divides according to whether the system adapts
macro-pathways, micro-step hints, psychometric item selection, or
conversational dialogue:

  -------------- ---------------- -------------------- -------------------- --------------------
  **Lineage /    **Core Term**    **Primary Mechanism  **Canonical Systems  **Architectural
  Category**                      & Theoretical        & Examples**         Limitation Addressed
                                  Lineage**                                 by Wayfinder**

  **Umbrella &   **Adaptive       Broad adjustment of  Commercial edtech &  Conflates static
  Standards**    Learning**       content, sequence,   LMS platforms        branching rules with
                                  pacing, or                                dynamic closed-loop
                                  difficulty based on                       control.
                                  learner performance                       
                                  telemetry^26^.                            

  **Umbrella &   **Adaptive       Formal architecture  GIFT, IEEE AIS       Defines modular
  Standards**    Instructional    standards separating standards            interfaces but
                 Systems (AIS)**  domain, learner, and                      leaves
                                  pedagogical models                        cross-timescale
                                  (IEEE / Learning                          conflict resolution
                                  Engineering).                             unspecified.

  **Umbrella &   **Intelligent    One-to-one tutoring  Carnegie Learning    Excels at micro-step
  Standards**    Tutoring Systems behavior via         Cognitive Tutor,     scaffolding but can
                 (ITS)**          step-level           ASSISTments, Andes   trap learners in
                                  diagnosis, model     Physics^7^           local
                                  tracing, hints, and                       \"wheel-spinning\"
                                  immediate feedback                        loops^14^.
                                  over production                           
                                  rules^2^.                                 

  **Umbrella &   **Personalized   Marketing and L&D    Corporate L&D,       Often treats learner
  Standards**    Learning**       umbrella combining   Learning Experience  overrides as noise
                                  algorithmic routing  Platforms (LXPs)     or surrenders
                                  with learner choice                       pedagogical rigor to
                                  or self-paced                             uncalibrated
                                  pathways.                                 preferences.

  **Item & State **Computerized   Selects the next     GRE, GMAT, Amsterdam Optimizes
  Estimation**   Adaptive Testing question based on    Chess Test^6^        measurement
                 (CAT)**          estimated ability                         precision of a
                                  using Item Response                       static trait rather
                                  Theory (IRT) to                           than longitudinal
                                  maximize measurement                      learning gain^6^.
                                  information^5^.                           

  **Item & State **Knowledge      Longitudinal         BKT^8^, PFA^8^, Deep Point-estimate
  Estimation**   Tracing (KT)**   estimation of latent Knowledge Tracing    mastery ignores
                                  skill mastery over   (DKT)^25^            epistemic
                                  time from sequential                      uncertainty, active
                                  binary responses^8^.                      misconceptions, and
                                                                            context transfer^4^.

  **Item & State **Learner /      Broader maintenance  BUGGY^17^, Help      Rarely coupled
  Estimation**   Student          of a representation  Tutor^27^, SMILI☺    directly to a single
                 Modelling**      of what a learner    Open Learner         multi-objective
                                  knows, believes, or  Models^32^           trajectory
                                  misunderstands^7^.                        planner^3^.

  **Routing &    **Knowledge      Combinatorial        ALEKS (Assessment    Identifies what a
  Pedagogy**     Space Theory     mapping of feasible  and Learning in      student is *ready*
                 (KST)**          knowledge states via Knowledge Spaces)^9^ to learn (outer
                                  surmise                                   fringe), but not
                                  (prerequisite)                            when to abandon a
                                  relations and                             depleted patch^9^.
                                  inner/outer                               
                                  fringes^9^.                               

  **Routing &    **Mastery        Gating progression   Khan Academy         Fixed thresholds
  Pedagogy**     Learning &       on reaching a fixed  Mastery, Knewton,    ignore marginal
                 Curriculum       mastery threshold    Smart Sparrow,       learning rates and
                 Sequencing**     (e.g., 0.88--0.95)   Realizeit, Cogbooks, fight separate
                                  along a directed     Duolingo^37^         spaced-repetition
                                  graph^4^.                                 schedulers^4^.

  **Routing &    **Zone of        Vygotskian targeting ZPDES Bandit         Often reduced in
  Pedagogy**     Proximal         of items just beyond Tutors^38^,          software to a scalar
                 Development      current independent  Cognitive            difficulty slider
                 (ZPD)**          ability via          Apprenticeship^16^   rather than
                                  contingent                                multidimensional
                                  scaffolding^16^.                          role/scaffold
                                                                            shifting^24^.

  **Generative   **Generative /   LLM-based adaptive   LLM-based AI tutors, High policy drift
  AI**           Conversational   tutoring where       conversational       and sycophancy risk
                 Tutoring**       adaptation emerges   courseware           when LLMs are
                                  from dialogue rather                      granted
                                  than a pre-built                          path-selection
                                  item bank and path                        authority.
                                  graph^35^.                                
  -------------- ---------------- -------------------- -------------------- --------------------

### 1.2 How the Pieces Fit Together: From Item Calibration to Path Selection

In a conventional adaptive architecture, data flows through five
sequential stages developed by overlapping research communities in EDM,
LAK, AIED, and applied Learning Engineering^8^:

1.  **Domain Cartography & Prerequisite Extraction**: Authors or
    automated algorithms---such as the expert-querying QUERY algorithm
    in Knowledge Space Theory (Koppen & Doignon, 1990) or Learning
    Factors Analysis (LFA; Cen, Koedinger, & Junker)---decompose a
    subject domain into atomic Knowledge Components (KCs) or problem
    types^8^. Prerequisite partial orders (surmise relations) define the
    Directed Acyclic Graph (DAG) of feasible knowledge states, where a
    learner\'s *inner fringe* represents what they have most recently
    mastered and their *outer fringe* represents the exact items they
    are ready to learn next^9^.

2.  **Psychometric Item Calibration**: Historical response logs are fit
    using Rasch (1PL), 2PL, or 3PL Item Response Theory models to
    estimate item difficulty
    (![](media/image134.png){width="0.18375656167979001in"
    height="0.22459098862642168in"} or
    ![](media/image153.png){width="0.1576334208223972in"
    height="0.2311953193350831in"}), discrimination, and careless slip
    (![](media/image146.png){width="0.20426509186351707in"
    height="0.22469050743657043in"}) or lucky guess
    (![](media/image140.png){width="0.18945319335083113in"
    height="0.23155402449693788in"}) parameters^43^, or multi-KC
    Q-matrices in LFA and Performance Factors Analysis^8^.

3.  **Knowledge Tracing & State Updating**: As a learner interacts with
    calibrated items, the student model updates its latent state
    estimate. Classical Bayesian Knowledge Tracing (BKT; Corbett &
    Anderson, 1994) maintains a two-state Hidden Markov Model per skill
    governed by four parameters---initial learning probability
    (![](media/image158.png){width="0.23168963254593175in"
    height="0.23168963254593175in"}), transition/learning probability
    (![](media/image159.png){width="0.1548665791776028in"
    height="0.22713801399825023in"}), guess
    (![](media/image152.png){width="0.16845691163604548in"
    height="0.23162839020122486in"}), and slip
    (![](media/image142.png){width="0.14371719160104987in"
    height="0.22584208223972002in"})^8^. Performance Factors Analysis
    (PFA; Pavlik, Cen, & Koedinger, 2009) reconfigures logistic
    regression to predict the log-odds of correctness
    ![](media/image147.png){width="0.18815069991251093in"
    height="0.22996281714785652in"} from item/KC difficulty
    ![](media/image155.png){width="0.13264982502187225in"
    height="0.22448490813648295in"} plus scaled counts of prior
    successes (![](media/image141.png){width="0.378173665791776in"
    height="0.23110673665791776in"}) and failures
    (![](media/image145.png){width="0.39371719160104984in"
    height="0.22794181977252842in"}) across multiple KCs, avoiding
    BKT\'s overly aggressive downward adjustment after a single
    error^8^. Deep Knowledge Tracing (DKT) replaces explicit Markov
    states with recurrent neural networks, though systematic audits by
    Khajah, Lindsey, and Mozer (2016) demonstrate that DKT\'s predictive
    gains over standard BKT are largely matched when BKT is extended
    with forgetting decay, student ability priors, and skill
    discovery^25^.

4.  **Inner-Loop Micro-Adaptation**: Within a multi-step problem, an ITS
    uses model tracing over ACT-R production rules (IF \<condition\>
    THEN \<actions\>) to compare student actions against expert
    problem-space paths, flagging procedural bugs and delivering
    graduated context-sensitive hints^2^.

5.  **Outer-Loop Path Selection & Review Scheduling**: A macro-sequencer
    routes the learner to the next unmastered skill in the outer fringe
    once estimated mastery crosses a fixed threshold (e.g.,
    0.88--0.95)^4^, while an independent spaced repetition
    scheduler---such as a Leitner queue network (Reddy, Labutov,
    Banerjee, & Joachims, 2016)^5^ or a marked temporal point-process
    controller (MEMORIZE; Tabibian et al., 2019)^11^---interrupts
    forward progress to schedule reviews as memory decays.

![](media/image149.png){width="6.458333333333333in"
height="3.5208333333333335in"}

### 1.3 Why the \"Curriculum with a Difficulty Dial\" Fails

When these traditional modules are bolted together in production, three
structural pathologies emerge. First, classical mastery-learning loops
frequently trap learners in **wheel-spinning**---defined by Beck and
Gong (2013) as situations in which learners persist for extended periods
of time on a skill without achieving mastery or demonstrating durable
learning^14^. Because a point-estimate BKT or IRT loop only registers
low mastery, it continues serving standard items on the same skill
rather than recognizing that the local patch is depleted or blocked by
an unmeasured prerequisite gap or misconception^4^.

Second, clamping practice to a fixed scalar success rate---such as the
**Eighty-Five Percent Rule** derived by Wilson, Shenhav, Straccia, and
Cohen (2019)---misapplies a perceptual gradient-descent optimum to
structured human cognition^12^. Wilson et al. demonstrated theoretically
and in neural network simulations that for stochastic gradient-descent
algorithms in binary classification tasks under Gaussian noise, clamping
training accuracy to around 85% (an optimal error rate of 15.87%)
maximizes the rate at which representation precision
![](media/image155.png){width="0.13264982502187225in"
height="0.22448490813648295in"} improves^12^. However, human conceptual
learning is not homogeneous gradient descent over a stationary binary
boundary^49^. A learner who achieves 85% accuracy via slow,
low-confidence guessing requires schema consolidation and
self-explanation, whereas a learner who commits a fast, 90%-confident
error is executing a systematic procedural bug^17^ that can be rapidly
dismantled via the *hypercorrection effect*^15^. Reducing difficulty to
a single scalar slider discards the diagnostic signal carried by
response latency and metacognitive confidence^6^.

Third, when engineering teams patch these gaps by adding independent
heuristics---a Leitner queue for spaced review^5^, an extrinsic
gamification layer (streaks, badges, XP counters) for engagement^53^, a
threshold rule for prerequisites, and an error-count trigger for
hints---the heuristics collide. Research syntheses on the 85% rule
versus gamification highlight that visible point counters and streaks
recruit an extrinsic reward circuit that displaces intrinsic motivation,
shifts feedback from process-level to self-level, and amplifies anxiety
for struggling learners^53^. Meanwhile, the spaced-repetition scheduler
pulls the learner away just as a conceptual breakthrough begins, causing
the engine to oscillate silently between competing rules.

## 2. Theoretical Foundations of Cognitive Foraging: The Seven Borrowed Lenses

Cognitive Foraging reconceptualizes learning not as the accumulation of
correct answers, but as an active search through a patchy knowledge
landscape governed by resource depletion, regeneration, information
value, and context transfer^2^. This requires the engine to continuously
answer three foundational questions:

1.  **Readiness**: *What is the learner ready to learn?* (The outer
    fringe of prerequisite readiness and epistemic uncertainty)^9^.

2.  **Patch Productivity**: *Is this patch still productive, or should
    we move?* (Marginal learning rate relative to switching costs and
    alternative patches)^1^.

3.  **Transferability**: *Will this help later, in a different context?*
    (Retention stability, cross-skill transfer coupling, and downstream
    option value)^4^.

To answer all three questions within a single mathematical framework,
Wayfinder synthesizes seven cross-disciplinary lenses:

### 2.1 Ecology: Optimal Foraging and the Marginal Value Theorem (MVT)

In behavioral ecology (Charnov, 1976; Eliassen et al., 2009) and
Information Foraging Theory (Pirolli, 2007), an agent harvesting
resources in a patchy environment faces a fundamental patch-departure
decision^1^. Within any skill patch
![](media/image143.png){width="0.11832677165354331in"
height="0.23665463692038496in"}, cumulative knowledge gain
![](media/image148.png){width="0.5812171916010499in"
height="0.22833552055993in"} exhibits diminishing marginal returns as
local attention time ![](media/image156.png){width="0.218669072615923in"
height="0.22908136482939634in"} increases^1^. Charnov\'s Marginal Value
Theorem shows that the rate-maximizing time
![](media/image157.png){width="0.16308508311461067in"
height="0.22424212598425197in"} to spend in a patch occurs when the
instantaneous marginal rate of intake
![](media/image151.png){width="0.45149825021872264in"
height="0.23099846894138232in"} drops to the long-term average return
rate across available patches, after accounting for the travel
(switching) cost ![](media/image63.png){width="0.5208333333333334in"
height="0.22916666666666666in"} between patches^1^:

![](media/image120.png){width="6.458333333333333in"
height="1.0778608923884514in"}

Because direct application of MVT assumes omniscience regarding patch
quality, practical foraging controllers approximate MVT online using
reinforcement-learning or moving-average estimates of patch gain rates
and differential travel costs^1^. Crucially, in Cognitive Foraging,
**spaced review is not a separate scheduler fighting the mastery model;
it is patch regeneration**^1^. When a learner leaves a mastered patch,
memory traces undergo temporal decay while consolidation progresses;
over elapsed time, the potential marginal return of revisiting that
patch to multiply memory stability
![](media/image144.png){width="0.22493547681539808in"
height="0.22493547681539808in"} regenerates^4^. Wayfinder returns to a
skill for review when its regenerated marginal return exceeds the yield
of staying in the current patch.

### 2.2 Control Theory: Model Predictive Control (MPC) and POMDP Planning

Selecting a single next item myopically cannot capture multi-step
pedagogical synergies---such as destabilizing a misconception with a
contrasting case in step
![](media/image30.png){width="7.73928258967629e-2in"
height="0.2432338145231846in"} so that a guided worked example in step
![](media/image129.png){width="0.44653324584426946in"
height="0.22845909886264218in"} achieves a \"time for telling\"
breakthrough^4^. Formulating instruction as a Partially Observable
Markov Decision Process (POMDP), as demonstrated by Rafferty, Brunskill,
Griffiths, and Shafto (2016), maps the learner\'s hidden knowledge state
to a probabilistic belief state
![](media/image160.png){width="0.15681977252843396in"
height="0.23000218722659668in"} and selects pedagogical actions to
optimize discounted future value over a planning horizon^3^. Because
offline infinite-horizon POMDP solvers become computationally
intractable as the state space scales across continuous multi-skill
models^3^, Wayfinder implements **receding-horizon Model Predictive
Control (MPC)**: at each decision epoch, the controller forecasts belief
trajectories over a short lookahead horizon
(![](media/image69.png){width="0.5883792650918636in"
height="0.23114938757655293in"} steps), scores the composite trajectory
under system constraints, executes the first action
![](media/image139.png){width="0.19905621172353455in"
height="0.23048665791776027in"}, observes the learner\'s response, and
replans^4^.

### 2.3 Information Theory: Bayesian Experimental Design (ADO)

Standard adaptive engines select items where the learner is likely to
succeed, conflating *assessment* with *reinforcement*. Drawing on
Adaptive Design Optimization (ADO; Myung, Cavagnaro, & Pitt, 2013),
Wayfinder treats diagnostic probing as an optimal Bayesian
experiment^20^. In ADO, each candidate activity or stimulus design
![](media/image132.png){width="0.11336286089238845in"
height="0.22672462817147856in"} is evaluated by a utility function based
on mutual information---equivalent to expected Shannon entropy
reduction---between the latent learner parameters
![](media/image137.png){width="0.16674759405074366in"
height="0.2292782152230971in"} (mastery
![](media/image154.png){width="0.2816568241469816in"
height="0.229498031496063in"} and misconception state
![](media/image21.png){width="0.2227373140857393in"
height="0.2333442694663167in"}) and the predicted observation
![](media/image53.png){width="0.10904965004374453in"
height="0.2399103237095363in"}^21^:

![](media/image23.png){width="6.458333333333333in"
height="0.8304833770778652in"}

As Myung et al. note, the observation that yields the highest expected
information gain is the one whose outcome reduces posterior uncertainty
in the fewest steps^21^. Thus, a skill at 70% estimated mastery with
high epistemic variance
(![](media/image32.png){width="0.21590223097112862in"
height="0.2261832895888014in"}) triggers a fast, low-scaffold diagnostic
probe, whereas a skill at 70% mastery with tight posterior certainty
receives targeted practice or transfer challenges^4^.

### 2.4 Statistical Physics: Criticality and Productive Surprise

Autonomous developmental systems, such as Oudeyer, Kaplan, and Hafner\'s
(2007) *Intelligent Adaptive Curiosity (IAC)*, demonstrate that
intrinsic learning progress peaks neither in overly predictable regimes
(where prediction error is zero and attention drops) nor in chaotic
regimes (where excessive complexity overwhelms the learner\'s predictive
model)^22^. Instead, developmental sequences self-organize at the **edge
of chaos**---an intermediate zone of *productive surprise* where the
expected reduction in prediction error is maximal^22^. Wayfinder
operationalizes criticality not by clamping accuracy to 85%, but by
targeting a band of prediction error indexed jointly by learner
confidence, response accuracy, and speed-accuracy drift^4^.

### 2.5 Immunology: The Misconception Repertoire

In the diagnostic ITS lineage founded by Brown and Burton\'s (1978)
*BUGGY* model, student errors in procedural skills are recognized not as
random failures, but as symptoms of discrete \"bugs\"---systematic
modifications to correct production rules (e.g., subtracting the smaller
digit from the larger regardless of column position, or blindly
accepting HEAD in a Git merge conflict)^4^. Cognitive Foraging treats
misconceptions as **recurring cognitive pathogens**^17^. While
Butterfield and Metcalfe (2001) showed that errors committed with high
confidence are strongly hypercorrected upon immediate feedback^15^,
longitudinal memory studies by Butler, Fazio, and Marsh revealed that if
the corrective memory trace is forgotten over time, the original
high-confidence error is likely to resurface^60^. Wayfinder therefore
maintains an explicit *misconception repertoire* for each learner,
deploying side-by-side contrasting cases (cognitive antigens) followed
by spaced immunization exposures to build durable resistance^4^.

### 2.6 Cognitive Apprenticeship: Dynamic Role Adaptation

Collins, Brown, and Newman (1989) established that formal schooling
often fails because expert thinking processes remain invisible behind
finished text or lectures^16^. *Cognitive Apprenticeship* makes tacit
cognitive and metacognitive processes visible across six teaching
methods: **Modeling, Coaching, Scaffolding (with Fading), Articulation,
Reflection, and Exploration**^16^. However, systematic reviews of STEM
implementations indicate that digital environments overwhelmingly
implement only coaching and scaffolding (15.3% of applied codes across
17 studies) while neglecting reflection (3.5%), articulation (3.5%),
exploration (2.9%), and sequencing (5.3%)^61^. Wayfinder embeds role
progression directly into its action space, moving the learner from
**Observer** (analyzing contrasting cases and expert think-aloud models)
to **Guided Practitioner** (executing decisions with visible
scaffolding) to **Independent Practitioner & Reviewer** (articulating
explanations, auditing buggy examples, and solving far-transfer probes
as support fades)^4^.

### 2.7 Economics: Real Option Value in Curriculum Graphs

In a structured knowledge space, foundational skills possess high
**option value** (![](media/image24.png){width="0.6375328083989501in"
height="0.2299300087489064in"}): keeping a core prerequisite alive and
fluent above its readiness threshold unlocks a wide fan of downstream
outer-fringe paths and synthesis projects^4^. Wayfinder incorporates
real option value into its objective scorer, justifying brief
maintenance reviews on high-centrality skills before their decay locks
out future curriculum trajectories^4^.

## 3. Formal Mathematical Specification of the Wayfinder Engine

To eliminate the policy drift caused by competing heuristics, Wayfinder
enforces a single architectural invariant: **one probabilistic state
model, one unified objective function, and one constrained
controller**^4^.

### 3.1 The Multi-Dimensional Distributional Learner Model

Rather than representing each skill
![](media/image77.png){width="1.3763024934383201in"
height="0.22938320209973753in"} with a point-estimate mastery
probability, WayfinderBeliefState maintains a factored probabilistic
belief state ![](media/image31.png){width="1.743655949256343in"
height="0.22970363079615047in"} across seven state dimensions^4^:

  ----------------------- ------------------------------------------------------ ------------------------------------------------------
  **State Dimension**     **Mathematical Representation**                        **Update Signal & Dynamic Role in Wayfinder**

  **1. Mastery            Conjugate Beta distribution                            Updated via accuracy
  Probability & Epistemic ![](media/image26.png){width="2.019854549431321in"     ![](media/image97.png){width="0.16992235345581802in"
  Uncertainty**           height="0.2290551181102362in"} with mean               height="0.2336428258967629in"}, confidence
                          ![](media/image28.png){width="0.2972823709536308in"    ![](media/image10.png){width="0.1577143482064742in"
                          height="0.2255249343832021in"} and variance            height="0.2313145231846019in"}, and latency weight
                          ![](media/image7.png){width="0.31184930008748907in"    ![](media/image2.png){width="0.5231933508311462in"
                          height="0.2286887576552931in"}^4^.                     height="0.2302055993000875in"}. High variance
                                                                                 ![](media/image7.png){width="0.31184930008748907in"
                                                                                 height="0.2286887576552931in"} triggers diagnostic
                                                                                 probes; low variance enables practice or transfer^4^.

  **2. Misconception      Bug probability vector                                 High-confidence errors
  Probabilities**         ![](media/image5.png){width="1.2262390638670166in"     (![](media/image13.png){width="1.4825in"
                          height="0.22862095363079615in"} over cataloged         height="0.22968285214348205in"}) cause a sharp
                          procedural bugs^4^.                                    posterior jump
                                                                                 (![](media/image20.png){width="1.4884481627296589in"
                                                                                 height="0.22899168853893262in"}); side-by-side
                                                                                 contrast cases dismantle active bugs
                                                                                 (![](media/image1.png){width="1.3516458880139983in"
                                                                                 height="0.22874015748031495in"})^4^.

  **3. Context Transfer   Latent transfer capability                             Standard drill barely moves transfer
  Strength**              ![](media/image6.png){width="0.9737959317585302in"     (![](media/image49.png){width="1.3298337707786527in"
                          height="0.2303597987751531in"} coupled via domain      height="0.22856517935258092in"}), whereas far-transfer
                          transfer matrix                                        probes boost
                          ![](media/image11.png){width="0.9915365266841645in"    ![](media/image45.png){width="0.28312226596675416in"
                          height="0.2296194225721785in"}^4^.                     height="0.23069225721784778in"} and propagate gains to
                                                                                 coupled downstream skills^4^.

  **4. Memory Stability & Half-life stability                                    Temporal decay discounts
  Decay Lag**             ![](media/image48.png){width="1.33292760279965in"      ![](media/image57.png){width="0.32666010498687664in"
                          height="0.22909667541557305in"} and elapsed time since height="0.23182305336832895in"} via
                          practice                                               ![](media/image51.png){width="2.1185728346456694in"
                          ![](media/image56.png){width="0.4453937007874016in"    height="0.22959864391951007in"}, lowering
                          height="0.22787620297462818in"}^4^.                    ![](media/image28.png){width="0.2972823709536308in"
                                                                                 height="0.2255249343832021in"} and inflating variance
                                                                                 ![](media/image7.png){width="0.31184930008748907in"
                                                                                 height="0.2286887576552931in"}. Spaced retrieval
                                                                                 multiplies
                                                                                 ![](media/image61.png){width="0.3208825459317585in"
                                                                                 height="0.2277230971128609in"}^4^.

  **5. Patch Marginal     Exponentially weighted moving average                  Decays exponentially with consecutive homogeneous
  Learning Rate**         ![](media/image65.png){width="2.272541557305337in"     drill on the same skill
                          height="0.22933945756780402in"}^4^.                    (![](media/image50.png){width="2.1343536745406824in"
                                                                                 height="0.22905293088363954in"}), driving MVT
                                                                                 patch-leaving and role-switching decisions^1^.

  **6. Metacognitive      Rolling Brier score                                    Quantifies overconfidence
  Calibration**           ![](media/image39.png){width="1.9344061679790026in"    (![](media/image37.png){width="0.8613276465441819in"
                          height="0.22880030621172354in"} and signed bias        height="0.22830380577427822in"}) vs. underconfidence
                          ![](media/image36.png){width="1.9813648293963255in"    (![](media/image42.png){width="0.8613276465441819in"
                          height="0.22942147856517936in"}^4^.                    height="0.22830380577427822in"}), governing
                                                                                 contrast-case selection and Meta-loop reflection^4^.

  **7. Strategy & Context Global vector                                          Tracks hint abuse vs. help avoidance (Help Tutor
  Profile**               ![](media/image80.png){width="0.18806977252843396in"   rules)^7^ and enforces hard vetoes when frustration
                          height="0.2298632983377078in"}: help-seeking profile,  ![](media/image44.png){width="0.20263670166229222in"
                          frustration                                            height="0.2346314523184602in"} spikes or the learner
                          ![](media/image44.png){width="0.20263670166229222in"   selects a policy mode^4^.
                          height="0.2346314523184602in"}, time budget, and       
                          learner mode^4^.                                       
  ----------------------- ------------------------------------------------------ ------------------------------------------------------

Modeling mastery via the conjugate Beta distribution
![](media/image26.png){width="2.019854549431321in"
height="0.2290551181102362in"} provides closed-form expressions for both
posterior mean mastery
![](media/image28.png){width="0.2972823709536308in"
height="0.2255249343832021in"} and epistemic variance
![](media/image7.png){width="0.31184930008748907in"
height="0.2286887576552931in"}^4^:

![](media/image33.png){width="6.458333333333333in"
height="1.060191382327209in"}

When a skill goes unpracticed over an interval
![](media/image105.png){width="0.25594050743657043in"
height="0.22522747156605424in"}, discounting the concentration
parameters ![](media/image88.png){width="0.8994958442694663in"
height="0.23010389326334207in"} toward the prior simultaneously pulls
back mean mastery ![](media/image28.png){width="0.2972823709536308in"
height="0.2255249343832021in"} and inflates epistemic uncertainty
![](media/image7.png){width="0.31184930008748907in"
height="0.2286887576552931in"}^4^. This captures a critical distinction
that scalar BKT misses: a newly encountered skill at 70% mastery
(![](media/image91.png){width="2.569739720034996in"
height="0.2288834208223972in"}) and a heavily practiced skill at 70%
mastery (![](media/image85.png){width="2.784093394575678in"
height="0.22940069991251094in"}) require completely different
pedagogical actions^4^.

### 3.2 The Objective Function: Expected Transferable Learning per Unit of Attention

At decision step ![](media/image30.png){width="7.73928258967629e-2in"
height="0.2432338145231846in"}, Wayfinder evaluates any candidate action
![](media/image93.png){width="1.7853226159230096in"
height="0.22969050743657043in"} by scoring its **Expected Transferable
Learning per Unit of Attention (ETL/UA)**^4^:

![](media/image78.png){width="6.458333333333333in"
height="1.3870844269466316in"}

In this formulation, the numerator balances four positive value drivers
against two cognitive cost/risk penalties, while the denominator
normalizes by total attention expenditure^4^. Specifically,
![](media/image79.png){width="0.9145505249343832in"
height="0.22863735783027123in"} forecasts durable mastery gain retained
after temporal decay (combining acquisition with stability reinforcement
![](media/image87.png){width="0.4034831583552056in"
height="0.22760608048993874in"})^4^;
![](media/image76.png){width="0.6278477690288714in"
height="0.23021106736657918in"} captures direct context-transfer growth
plus downstream spillover across the transfer coupling matrix
![](media/image96.png){width="0.1714676290463692in"
height="0.23576771653543308in"}^4^;
![](media/image81.png){width="0.6012379702537183in"
height="0.22805555555555557in"} rewards posterior variance and
misconception uncertainty reduction^4^; and
![](media/image74.png){width="0.5066732283464567in"
height="0.2274857830271216in"} provides an option-value and curiosity
bonus for skills that unlock major subtrees in the curriculum graph^4^.
Against these gains, ![](media/image83.png){width="0.7840168416447943in"
height="0.22997812773403326in"} penalizes intrinsic and extraneous
cognitive load (ranging from 0.15 for guided worked examples to
0.40--0.65 for un-scaffolded transfer probes)^4^, and
![](media/image82.png){width="1.141353893263342in"
height="0.22827099737532808in"} penalizes actions that risk frustration
or overconfident error entrenchment when
![](media/image75.png){width="0.2227373140857393in"
height="0.2333442694663167in"} or
![](media/image44.png){width="0.20263670166229222in"
height="0.2346314523184602in"} is high^4^. Dividing by
![](media/image62.png){width="2.4678543307086613in"
height="0.229083552055993in"} enforces Charnov\'s Marginal Value
Theorem: switching to a new skill patch is only justified when its net
instructional yield outweighs the cognitive travel cost
![](media/image63.png){width="0.5208333333333334in"
height="0.22916666666666666in"}^1^.

To plan beyond a single item, the 3-step receding-horizon MPC controller
(choose_action_wayfinder_mpc) performs a beam search over horizon
![](media/image69.png){width="0.5883792650918636in"
height="0.23114938757655293in"} with discount factor
![](media/image99.png){width="1.2777504374453192in"
height="0.2285411198600175in"}, selecting the initial action
![](media/image139.png){width="0.19905621172353455in"
height="0.23048665791776027in"} that maximizes the cumulative trajectory
score^4^:

![](media/image125.png){width="6.458333333333333in"
height="1.4931025809273841in"}

## 4. Multi-Scale Coordination, Foraging Policy, and Productive Surprise

### 4.1 The Four-Timescale Coordinator

Conventional adaptive systems collapse micro-step hints, skill
switching, curriculum routing, and metacognitive reflection into one
flat rule set, causing high-frequency oscillation. Wayfinder separates
adaptation into four hierarchical timescales, where slower scales set
reference priors and boundary constraints for faster scales:

  -------------- --------------- ------------------------------------------------------- ------------------------------------------------------ ------------------------------------------------------
  **Adaptation   **Operational   **Primary State Variables Monitored**                   **Control Decisions & Pedagogical Actions**            **Conflict Resolution Role**
  Scale**        Timescale**                                                                                                                    

  **Micro**      Seconds to      Step accuracy                                           Graduated hint delivery, immediate error feedback,     Executes within the skill patch and role selected by
                 minutes         ![](media/image97.png){width="0.16992235345581802in"    switching visual/symbolic representation, selecting    the Meso loop; triggers an emergency Meso abort if
                                 height="0.2336428258967629in"}, confidence              next item or contrast case^7^.                         frustration
                                 ![](media/image10.png){width="0.1577143482064742in"                                                            ![](media/image44.png){width="0.20263670166229222in"
                                 height="0.2313145231846019in"}, response latency                                                               height="0.2346314523184602in"} spikes.
                                 ![](media/image100.png){width="0.1645505249343832in"                                                           
                                 height="0.22625765529308836in"}, hint requests,                                                                
                                 productive-surprise quadrant^4^.                                                                               

  **Meso**       Minutes to      Patch marginal learning rate                            **Stay or leave a skill patch** (MVT foraging), shift  Constrains Micro item selection; arbitrates between
                 hours           ![](media/image89.png){width="0.31445319335083116in"    apprenticeship role (Observer                          local practice persistence and patch departure.
                                 height="0.23059930008748905in"}, epistemic variance     ![](media/image27.png){width="0.21427384076990377in"   
                                 ![](media/image7.png){width="0.31184930008748907in"     height="0.22447725284339456in"} Practitioner           
                                 height="0.2286887576552931in"}, bug probability         ![](media/image27.png){width="0.21427384076990377in"   
                                 ![](media/image111.png){width="0.31868547681539805in"   height="0.22447725284339456in"} Reviewer), review vs.  
                                 height="0.22616360454943132in"}, switching cost         explore^4^.                                            
                                 ![](media/image63.png){width="0.5208333333333334in"                                                            
                                 height="0.22916666666666666in"}^4^.                                                                            

  **Macro**      Days to weeks   KST inner/outer fringes, prerequisite readiness         Long-term path routing, prerequisite challenge tests,  Sets the active candidate set of skills and due-review
                                 ![](media/image108.png){width="0.517985564304462in"     multi-skill synthesis projects, regenerative           constraints for the Meso controller.
                                 height="0.22791338582677165in"}, memory stability       spaced-review scheduling^5^.                           
                                 ![](media/image61.png){width="0.3208825459317585in"                                                            
                                 height="0.2277230971128609in"}, option value                                                                   
                                 ![](media/image24.png){width="0.6375328083989501in"                                                            
                                 height="0.2299300087489064in"}, transfer                                                                       
                                 ![](media/image45.png){width="0.28312226596675416in"                                                           
                                 height="0.23069225721784778in"}^4^.                                                                            

  **Meta**       Weeks to months Rolling Brier calibration                               **Double-loop adaptation**: calibrating confidence vs. Governs global objective weights and honors
                                 ![](media/image95.png){width="0.3357753718285214in"     accuracy, teaching help-seeking & review habits,       learner-selected mode vetoes (Explore, Consolidate,
                                 height="0.23084536307961503in"}, signed bias            negotiating learning goals^27^.                        Challenge, Recover).
                                 ![](media/image94.png){width="0.4684251968503937in"                                                            
                                 height="0.2290080927384077in"}, help-seeking error                                                             
                                 rate, learner mode overrides^4^.                                                                               
  -------------- --------------- ------------------------------------------------------- ------------------------------------------------------ ------------------------------------------------------

### 4.2 How Cognitive Foraging Changes the Policy

Treating each skill
![](media/image143.png){width="0.11832677165354331in"
height="0.23665463692038496in"} as an ecological patch with marginal
learning rate ![](media/image65.png){width="2.272541557305337in"
height="0.22933945756780402in"} provides a principled mathematical
answer to five scheduling problems that current systems handle with ad
hoc heuristics^1^:

First, **when to stop practising a skill (patch departure)** is governed
by Charnov\'s tangent condition rather than an arbitrary mastery
ceiling^1^. As consecutive practice steps accumulate in patch
![](media/image143.png){width="0.11832677165354331in"
height="0.23665463692038496in"}, local resource depletion flattens the
gain slope ![](media/image89.png){width="0.31445319335083116in"
height="0.23059930008748905in"}^4^. Wayfinder leaves patch
![](media/image143.png){width="0.11832677165354331in"
height="0.23665463692038496in"} as soon as
![](media/image89.png){width="0.31445319335083116in"
height="0.23059930008748905in"} falls below the switch-cost-adjusted
return of the best alternative patch
![](media/image109.png){width="0.1861975065616798in"
height="0.2275754593175853in"}, preventing wheel-spinning^4^. Second,
**when to switch representation or cognitive role within a patch** is
determined by comparing method-specific marginal rates: if overall
mastery ![](media/image110.png){width="0.201334208223972in"
height="0.23312445319335084in"} is still low (e.g., 0.218) and standard
practice has flattened
(![](media/image102.png){width="1.0995308398950132in"
height="0.22820428696412948in"}) due to an active misconception
(![](media/image103.png){width="0.9965824584426947in"
height="0.22838363954505686in"}), the Meso controller stays on the
essential prerequisite patch but shifts the instructional *mode* to a
contrasting case followed by a guided worked example, rejuvenating the
learning rate^4^.

Third, **when to review (patch regeneration)** emerges naturally from
the same foraging equation without a competing cron scheduler^4^. In
queueing-network models of spaced repetition, Reddy et al. (2016)
demonstrated a sharp phase transition: if new-item arrival rates exceed
a critical threshold relative to review capacity, review queues become
unstable and blow up^5^. Wayfinder avoids queue instability by modeling
elapsed time ![](media/image101.png){width="0.3494466316710411in"
height="0.22611220472440946in"} on previously mastered skills
(![](media/image43.png){width="0.8680818022747157in"
height="0.23009405074365705in"}) as ecological patch regeneration: as a
skill rests and experiences slight concentration decay, the stability
multiplier available from a brief spaced_review (attention cost 0.80)
grows until its expected long-term mastery return
![](media/image79.png){width="0.9145505249343832in"
height="0.22863735783027123in"} organically surpasses the diminishing
return of the current patch^4^. Fourth, **when to skip ahead** and
**when to explore a new topic** are governed jointly by Bayesian
experimental design and option value: if a learner responds rapidly and
accurately with high confidence to a diagnostic probe on a
high-option-value outer-fringe skill, posterior variance
![](media/image32.png){width="0.21590223097112862in"
height="0.2261832895888014in"} collapses and unlocks downstream paths
immediately^4^.

### 4.3 Productive Surprise Instead of Scalar Difficulty

In psychometric speed-accuracy response models (Maris & van der Maas,
2012), response time
![](media/image30.png){width="7.73928258967629e-2in"
height="0.2432338145231846in"} and accuracy
![](media/image121.png){width="0.8986001749781277in"
height="0.22987423447069116in"} jointly form a sufficient statistic for
latent ability under the Signed Residual Time (SRT) scoring rule, where
fast accurate responses earn maximum credit and response latency
measures the distance between learner ability and item difficulty^6^.
Simultaneously, cognitive psychology research by Butterfield and
Metcalfe (2001, 2006) and Metcalfe and Finn (2011) establishes the
**hypercorrection effect**: when learners commit an error with high
confidence, corrective feedback triggers a metacognitive surprise spike
and attentional orienting response that makes the correction
substantially more likely to be encoded than feedback on low-confidence
errors^15^.

Wayfinder combines these mechanisms into a four-quadrant **Productive
Surprise Diagnostic Matrix** driven by accuracy
(![](media/image97.png){width="0.16992235345581802in"
height="0.2336428258967629in"}), confidence
(![](media/image10.png){width="0.1577143482064742in"
height="0.2313145231846019in"}), and normalized response latency
(![](media/image100.png){width="0.1645505249343832in"
height="0.22625765529308836in"})^4^:

  ------------------------------------------------------ ------------------------------------------------------ ------------------------------------------------------ --------------------- ------------------------------------------------------ ---------------
  **Confidence Level**                                   **Response Accuracy**                                  **Latency Signature (ztz_tzt​)**                        **Cognitive Diagnosis **Prescribed Wayfinder Action & Role Shift**           **Transparent
                                                                                                                                                                       & Criticality                                                                Learner
                                                                                                                                                                       Regime**                                                                     Explanation**

  **High Confidence**                                    **High Accuracy**                                      **Fast**                                               **Too Predictable     **Independent / Reviewer Role**: Strip scaffolding     *\"You solved
  (![](media/image66.png){width="0.8244630358705162in"   (![](media/image71.png){width="0.5628248031496063in"   (![](media/image70.png){width="0.8908683289588801in"   (Habituation Risk)**: (fade help), increase task ambiguity, or serve a       this quickly
  height="0.22959755030621173in"})                       height="0.22929899387576552in"})                       height="0.22789698162729657in"})                       Prediction error is   transfer_probe in a novel context^4^.                  with high
                                                                                                                                                                       near zero; current                                                           confidence, so
                                                                                                                                                                       representation is                                                            I am removing
                                                                                                                                                                       fluent^4^.                                                                   hints and
                                                                                                                                                                                                                                                    shifting to an
                                                                                                                                                                                                                                                    unfamiliar
                                                                                                                                                                                                                                                    context to test
                                                                                                                                                                                                                                                    transfer.\"*

  **Low Confidence**                                     **Low Accuracy**                                       **Slow**                                               **Too Chaotic         **Observer / Guided Role**: Serve a                    *\"This step is
  (![](media/image72.png){width="0.8244630358705162in"   (![](media/image68.png){width="0.5628248031496063in"   (![](media/image98.png){width="0.8908683289588801in"   (Cognitive Overload / worked_example_guided, a contrast_case, or retreat to  creating high
  height="0.22959755030621173in"})                       height="0.22929899387576552in"})                       height="0.22789698162729657in"})                       Wheel-Spinning)**:    an inner-fringe prerequisite^4^.                       cognitive load.
                                                                                                                                                                       Task exceeds current                                                         Let\'s step
                                                                                                                                                                       schema or                                                                    back to a
                                                                                                                                                                       prerequisite                                                                 guided worked
                                                                                                                                                                       readiness^14^.                                                               example with
                                                                                                                                                                                                                                                    visible expert
                                                                                                                                                                                                                                                    decisions.\"*

  **High Confidence**                                    **Low Accuracy**                                       **Fast / Mod**                                         **Misconception or    **Observer**                                           *\"I am
  (![](media/image66.png){width="0.8244630358705162in"   (![](media/image68.png){width="0.5628248031496063in"   (![](media/image92.png){width="0.5574540682414698in"   Calibration Failure   ![](media/image27.png){width="0.21427384076990377in"   switching to a
  height="0.22959755030621173in"})                       height="0.22929899387576552in"})                       height="0.22711067366579177in"})                       (Hypercorrection      height="0.22447725284339456in"} **Guided Role**:       contrast case
                                                                                                                                                                       Window)**: Fluent     Trigger a side-by-side contrast_case with an explicit  because your
                                                                                                                                                                       execution of a buggy  prediction prompt, followed by guided practice^4^.     confidence is
                                                                                                                                                                       rule^15^.                                                                    high while
                                                                                                                                                                                                                                                    accuracy is
                                                                                                                                                                                                                                                    low, indicating
                                                                                                                                                                                                                                                    a specific rule
                                                                                                                                                                                                                                                    trap.\"*

  **Low Confidence**                                     **High Accuracy**                                      **Slow / Mod**                                         **Fragile /           **Practitioner / Articulation Role**: Prompt for       *\"Your answer
  (![](media/image72.png){width="0.8244630358705162in"   (![](media/image71.png){width="0.5628248031496063in"   (![](media/image86.png){width="0.5574540682414698in"   Unconsolidated        self-explanation/articulation or serve a near-transfer was right, but
  height="0.22959755030621173in"})                       height="0.22929899387576552in"})                       height="0.22711067366579177in"})                       Mastery**: Correct    consolidation probe^16^.                               your confidence
                                                                                                                                                                       outcome reached                                                              was low. Let\'s
                                                                                                                                                                       tentatively or via                                                           consolidate why
                                                                                                                                                                       slow                                                                         that strategy
                                                                                                                                                                       trial-and-error^4^.                                                          worked before
                                                                                                                                                                                                                                                    moving on.\"*
  ------------------------------------------------------ ------------------------------------------------------ ------------------------------------------------------ --------------------- ------------------------------------------------------ ---------------

As Schwartz and Bransford (1998) demonstrated in *\"A Time for
Telling,\"* asking learners to analyze contrasting cases sensitizes them
to critical differentiating features that novices otherwise overlook;
once they notice those distinctions, they are prepared to learn deeply
from an explicit explanation or guided worked example, outperforming
direct instruction alone on 1-week delayed transfer tests^54^. Pairing
the hypercorrection effect^15^ with contrasting cases^54^ allows
Wayfinder to convert high-confidence mistakes into the engine\'s
highest-yield learning moments.

## 5. The Meta Loop: Double-Loop Adaptation and Open Learner Agency

In organizational and cognitive systems theory, Argyris and Schön (1978)
distinguish between **single-loop learning**---which acts like a
thermostat, adjusting action strategies to keep performance within fixed
governing variables---and **double-loop learning**, which feeds errors
and consequences back to question and modify the governing variables,
assumptions, and norms themselves^62^. Conventional adaptive courseware
is strictly single-loop: it silently adjusts item difficulty while
keeping the learner passive, frequently inducing \"Model I\" defensive
routines such as hint abuse, gaming the system to protect streaks, or
avoidance of challenge^7^.

Wayfinder implements **double-loop adaptation**: the *outer loop* adapts
the instructional path, while the *inner (meta) loop* improves the
learner\'s self-model, metacognitive calibration, and self-regulatory
agency^27^.

### 5.1 Operationalizing the SMILI☺ Open Learner Model and Help Tutor

Building on Bull and Kay\'s (2007, 2016) *SMILI☺ (Student Models that
Invite the Learner In)* Open Learner Modelling (OLM) framework^32^ and
Aleven, McLaren, Roll, and Koedinger\'s (2006) *Help Tutor*^7^, the
Wayfinder Meta Loop integrates five concrete mechanisms into the learner
interface. First, before attempting diagnostic or transfer tasks, the
learner commits to a rapid confidence prediction
![](media/image10.png){width="0.1577143482064742in"
height="0.2313145231846019in"} (\"Commit before you check\")^51^, and
the inspectable OLM displays their rolling calibration trajectory
(predicted confidence vs. realized accuracy and epistemic uncertainty
![](media/image32.png){width="0.21590223097112862in"
height="0.2261832895888014in"}) rather than gamified point totals^4^.
Second, following the Help Tutor cognitive model^7^, the Meta Loop
monitors step-level help-seeking errors---specifically *trying
unfamiliar steps without consulting hints/glossary* (help avoidance) and
*clicking through hints rapidly without deliberation* (help abuse)---and
delivers explicit metacognitive coaching on how to use scaffolding
deliberately^7^.

Third, in alignment with Argyris and Schön\'s \"Model II\" governing
values (*valid information, free and informed choice, and internal
commitment*)^63^, the learner can select or negotiate their active
policy mode at any time: **Explore** (boosting outer-fringe discovery
and curiosity weight
![](media/image90.png){width="0.37288385826771653in"
height="0.22787401574803148in"}), **Consolidate** (prioritizing
stability ![](media/image84.png){width="0.22493547681539808in"
height="0.22493547681539808in"} and variance reduction), **Challenge**
(prioritizing far-transfer probes
![](media/image73.png){width="0.24666338582677166in"
height="0.2261078302712161in"} with faded scaffolds), or **Recover**
(lowering cognitive load cost
![](media/image59.png){width="0.4389643482064742in"
height="0.2299332895888014in"} via worked examples and familiar
review)^4^. Fourth, when a learner overrides a recommended activity,
Wayfinder treats the override as Bayesian preference and context
evidence updating ![](media/image80.png){width="0.18806977252843396in"
height="0.2298632983377078in"} (such as inferring acute fatigue or a
preference for conceptual overview before drill) rather than penalizing
the learner^32^. Fifth, every controller transition is accompanied by a
transparent causal explanation derived directly from the active terms of
the ETL/UA objective function^4^.

## 6. Conflict Resolution Protocol & The Git Merge Conflict Execution Trace

### 6.1 Resolving Signal Conflicts Without Independent Heuristics

When multiple pedagogical signals disagree---for example, skill mastery
suggests advancing, calibration indicates confident-wrong
misconceptions, and a spaced review is due---a heuristic engine suffers
from rule-priority collisions. Wayfinder resolves all conflicts inside
its single controller by combining **lexicographic hard constraints**
with **expected long-term ETL/UA optimization**^4^:

1.  **Priority 1 --- Consent, Learner Mode, and Affective Safety (Hard
    Veto)**: The learner\'s chosen policy mode (Recover, Explore, etc.)
    and the frustration/confusion ceiling
    (![](media/image41.png){width="0.8981933508311462in"
    height="0.22977034120734907in"}) hold absolute veto power over
    high-load un-scaffolded actions^4^. Generative AI models have zero
    authority to override these safety constraints.

2.  **Priority 2 --- Due Review Floor (Queue Stability Constraint)**: To
    prevent the forgetting phase transition identified by Reddy et al.
    (2016)^5^, any skill whose elapsed lag exceeds its stability
    threshold (![](media/image46.png){width="0.9090168416447943in"
    height="0.2298665791776028in"} steps with
    ![](media/image43.png){width="0.8680818022747157in"
    height="0.23009405074365705in"} and
    ![](media/image38.png){width="0.8916830708661417in"
    height="0.22810476815398076in"}) receives a priority constraint
    boost in the objective scorer so due reviews cannot be ignored
    indefinitely^4^.

3.  **Priority 3 --- Prerequisite Readiness Gate**: In accordance with
    KST surmise relations^9^, outer-fringe skills whose joint
    prerequisite mastery
    ![](media/image34.png){width="1.2308748906386702in"
    height="0.22948490813648295in"} falls below 0.40 are gated from
    un-scaffolded practice unless the learner passes a diagnostic
    challenge probe^4^.

4.  **Priorities 4 to 6 --- Productive Struggle, Exploration, and
    Engagement (Continuous Objective Trade-off)**: Within the feasible
    action set satisfying Priorities 1--3, competing signals for
    productive struggle (misconception remediation and transfer),
    exploration (epistemic information gain), and engagement are
    resolved *quantitatively* by comparing their discounted 3-step
    contribution to ![](media/image47.png){width="1.2106146106736657in"
    height="0.2295997375328084in"}^4^.

### 6.2 Concrete Execution Trace: The Git Merge Conflict Scenario

To see how Wayfinder executes this protocol mathematically, consider the
exact trace from our simulation environment (KnowledgeLandscape over 6
Git skills: 0: Git Commit & Branch Basics, 1: Git Merge & Fast-Forward,
2: Git Merge Conflicts, 3: Git Rebase & Linear History, 4: Interactive
Rebase & Squash, 5: Distributed Team PR Workflows)^4^.

Suppose a learner has mastered prerequisites 0
(![](media/image40.png){width="3.2006036745406825in"
height="0.2293591426071741in"}) and 1
(![](media/image29.png){width="3.307781058617673in"
height="0.2288396762904637in"}) and is currently foraging in **Patch 2
(2: Git Merge Conflicts)**^4^. The learner attempts two consecutive
standard merge conflict problems and misses both
(![](media/image67.png){width="1.412594050743657in"
height="0.22850831146106737in"}) while reporting high confidence
(![](media/image64.png){width="1.9358748906386702in"
height="0.22897419072615924in"}) with fast response latency
(![](media/image55.png){width="2.2830413385826773in"
height="0.22934711286089238in"}) and rising hint use^4^.

At decision epoch ![](media/image30.png){width="7.73928258967629e-2in"
height="0.2432338145231846in"}, WayfinderBeliefState updates Skill 2 to
a posterior mastery mean of
![](media/image60.png){width="0.9673665791776028in"
height="0.2288396762904637in"} with epistemic variance
![](media/image58.png){width="1.0967607174103238in"
height="0.22979768153980754in"}^4^. Because both errors occurred rapidly
at high confidence (![](media/image52.png){width="0.7596030183727034in"
height="0.228921697287839in"}), the posterior misconception probability
jumps to ![](media/image16.png){width="0.9887696850393701in"
height="0.22897856517935258in"} (diagnosing a classic procedural bug,
such as deleting conflict markers or blindly accepting HEAD without
integrating both branch changes), signed overconfidence bias reaches
![](media/image54.png){width="0.6548665791776028in"
height="0.2286832895888014in"}, and the patch marginal learning rate on
standard practice flattens to
![](media/image18.png){width="1.091719160104987in"
height="0.2287412510936133in"}^4^. Comparing the rejected heuristic
action (standard_practice on Skill 2) against Wayfinder\'s selected
intervention (contrast_case on Skill 2) illustrates how the controller
shifts the kind of thinking required^4^:

  ---------------- ----------------------------------------------------- ------------------- ----------------- ------------------------------------------------------
  **Objective      **Symbol & Weight**                                   **Candidate A:      **Candidate B:    **Pedagogical & Mathematical Rationale**
  Component /                                                            Serve Another       Serve             
  Metric**                                                               standard_practice   contrast_case +   
                                                                         (Rejected)**        Prediction        
                                                                                             (Selected)**      

  **Expected       ![](media/image12.png){width="1.2103641732283466in"   +0.0099             **+0.3726**       Standard practice is throttled by patch depletion
  Long-Term        height="0.22955161854768155in"}                                                             (![](media/image18.png){width="1.091719160104987in"
  Mastery Gain**                                                                                               height="0.2287412510936133in"}) and bug interference
                                                                                                               (![](media/image16.png){width="0.9887696850393701in"
                                                                                                               height="0.22897856517935258in"}). Contrast case
                                                                                                               triggers hypercorrection^4^.

  **Expected       ![](media/image8.png){width="0.8666994750656168in"    +0.0576             **+0.0936**       Differentiating contrasting merge histories builds a
  Transfer Gain**  height="0.2297276902887139in"}                                                              transferable mental model for downstream Rebasing and
                                                                                                               PR workflows^4^.

  **Expected       ![](media/image15.png){width="0.9294433508311462in"   +0.0225             **+0.3262**       A targeted contrast probe discriminates the exact
  Information      height="0.229750656167979in"}                                                               misconception
  Gain**                                                                                                       (![](media/image17.png){width="0.2149245406824147in"
                                                                                                               height="0.2251596675415573in"}) far more efficiently
                                                                                                               than another failed drill item^4^.

  **Option Value & ![](media/image4.png){width="0.8717443132108487in"    +0.0606             **+0.0606**       Skill 2 has high curriculum option value
  Curiosity        height="0.22831364829396325in"}                                                             (![](media/image14.png){width="1.2931353893263342in"
  Bonus**                                                                                                      height="0.22942694663167104in"}) because it gates
                                                                                                               Skills 4 and 5^4^.

  **Cognitive Load ![](media/image3.png){width="1.0449168853893263in"    -0.1050             -0.1225           Side-by-side comparison requires slightly higher
  Cost**           height="0.22988188976377952in"}                                                             cognitive effort than rote drill, which is justified
                                                                                                               by its hypercorrection yield^4^.

  **Frustration &  ![](media/image9.png){width="0.9817705599300087in"    **-0.5996**         **0.0000**        Serving another un-scaffolded conflict when
  Overconfidence   height="0.22977580927384078in"}                                                             ![](media/image16.png){width="0.9887696850393701in"
  Risk**                                                                                                       height="0.22897856517935258in"} carries a severe risk
                                                                                                               of wheel-spinning and entrenched error^4^.

  **Attention +    ![](media/image19.png){width="1.0779582239720036in"   1.00 units          1.15 units        Staying in Skill 2 incurs zero skill-switch cost
  Switching Cost** height="0.23024387576552932in"}                                                             (![](media/image22.png){width="0.9137379702537183in"
                                                                                                               height="0.22843394575678042in"}), while the contrast
                                                                                                               case requires 1.15 attention units^4^.

  **Immediate Step ![](media/image35.png){width="0.9141437007874016in"   **-0.5540**         **+0.6351**       contrast_case outperforms standard_practice by +1.1891
  ETL/UA Score**   height="0.2285356517935258in"}                                                              ETL/UA points at step
                                                                                                               ![](media/image30.png){width="7.73928258967629e-2in"
                                                                                                               height="0.2432338145231846in"}^4^.

  **3-Step MPC     ![](media/image25.png){width="1.5038232720909885in"   Pruned (\< -0.50)   **+1.3314**       MPC plans the synergistic 3-step sequence:
  Trajectory       height="0.229750656167979in"}                                                               contrast_case
  Score**                                                                                                      ![](media/image27.png){width="0.21427384076990377in"
                                                                                                               height="0.22447725284339456in"} worked_example_guided
                                                                                                               ![](media/image27.png){width="0.21427384076990377in"
                                                                                                               height="0.22447725284339456in"} transfer_probe, plus
                                                                                                               spaced review^4^.
  ---------------- ----------------------------------------------------- ------------------- ----------------- ------------------------------------------------------

Rather than merely serving an \"easier\" merge conflict, the 3-step MPC
planner (Wayfinder_MPC_3Step) constructs a four-stage pedagogical
trajectory across timescales^4^. In **Step 1 (Immediate Micro/Meso
Action --- contrast_case, Observer Role, Step Score +0.6351)**, the
controller presents a side-by-side contrast case (e.g., comparing a
fast-forward merge against a true three-way conflicting commit graph)
and asks the learner to predict which branch lines must be retained,
accompanied by the explanation: *\"I am switching to a contrast case
because your confidence is high while accuracy is low, and the learning
rate on this skill has flattened\"*^4^. In **Step 2 (Lookahead**
![](media/image129.png){width="0.44653324584426946in"
height="0.22845909886264218in"} **--- worked_example_guided, Guided
Practitioner Role)**, having created a \"time for telling\" by
dismantling the misconception
(![](media/image17.png){width="0.2149245406824147in"
height="0.2251596675415573in"} drops from 0.804 to 0.442)^4^, the
planner schedules a guided merge with visible expert decision
rationales, capturing a 1.45x--1.55x instructional synergy boost^4^. In
**Step 3 (Lookahead**
![](media/image136.png){width="0.44653324584426946in"
height="0.22845909886264218in"} **--- transfer_probe, Independent
Practitioner Role, Cumulative 3-Step MPC Score +1.3314)**, scaffolding
fades and the learner resolves an independent merge conflict in a novel
repository context (1.40x--1.48x fading synergy)^4^. Finally, in **Step
4 (Macro Horizon +3 Days --- spaced_review, Patch Regeneration)**, the
controller schedules a spaced retrieval probe three days later to
multiply memory stability
![](media/image131.png){width="0.2171227034120735in"
height="0.22746172353455818in"} and block the prior high-confidence
misconception from resurfacing^4^.

## 7. Quantitative Simulation Benchmark Across Learner Archetypes

Before piloting an adaptive controller with live students, learning
engineering methodology (Clement, Roy, Oudeyer, & Lopes, 2015; Rafferty
et al., 2016) requires stress-testing candidate policies across diverse
simulated learner populations^3^. We evaluated four controllers across
![](media/image130.png){width="0.6953937007874016in"
height="0.22833770778652668in"} Monte Carlo episodes of
![](media/image133.png){width="0.6548665791776028in"
height="0.2286832895888014in"} instructional steps each, followed by a
14-day unpracticed retention decay period
(![](media/image135.png){width="0.9226881014873141in"
height="0.22808070866141733in"}), over the 6-skill Git curriculum
landscape^4^.

### 7.1 Synthetic Learner Archetypes and Controller Conditions

The simulation benchmark tests five synthetic learner archetypes
designed to expose specific failure modes of traditional adaptive
engines^4^. The **Calibrated Learner** represents a baseline profile
with normal forgetting
(![](media/image126.png){width="0.8880205599300087in"
height="0.22984033245844268in"}), low initial misconceptions
(![](media/image123.png){width="1.4532917760279964in"
height="0.22837489063867017in"}), and well-calibrated confidence
(![](media/image128.png){width="1.2037707786526683in"
height="0.22830161854768155in"})^4^. The **Misconception-Prone
Overconfident Learner** starts with high active bug strengths
(![](media/image124.png){width="0.2149245406824147in"
height="0.2251596675415573in"} up to 0.68 on Merge Conflicts) and strong
overconfidence (![](media/image117.png){width="1.2037707786526683in"
height="0.22830161854768155in"}), stalling on standard drill but
responding strongly to hypercorrection when given contrasting cases^4^.
The **Wheel-Spinner** exhibits severe diminishing returns on
un-scaffolded standard practice
(![](media/image119.png){width="2.3293438320209976in"
height="0.22877515310586177in"}) whenever prerequisite fluency is
incomplete or cognitive load is high^4^. The **Underconfident
Hint-Abuser** possesses solid learning potential but strong
underconfidence (![](media/image122.png){width="1.2037707786526683in"
height="0.22830161854768155in"}), over-relying on hints unless guided
through consolidated self-explanation and transfer^4^. Finally, the
**Rapid Forgetter / Context-Bound Learner** acquires rote performance
quickly but suffers rapid memory decay
(![](media/image118.png){width="0.8880205599300087in"
height="0.22984033245844268in"}, or 3.4x baseline decay) unless
stabilized via well-timed regenerative spaced reviews and context
transfer probes^4^.

Against these five archetypes, we compared four controllers: (1)
**BKT_Threshold_SM2**, a classical BKT mastery controller (practicing
the lowest unmastered skill until
![](media/image112.png){width="0.8680818022747157in"
height="0.23009405074365705in"}) interrupted every 8 steps by a rigid
SuperMemo-2 / Leitner review rule^4^; (2) **IRT_85_Rule**, a scalar
difficulty-dial controller that continuously selects the skill and
standard practice item closest to the 85% target accuracy band^4^; (3)
**Wayfinder_Greedy_1Step**, which uses the full distributional
WayfinderBeliefState, MVT foraging rule, and Productive Surprise
objective ![](media/image35.png){width="0.9141437007874016in"
height="0.2285356517935258in"} myopically
(![](media/image113.png){width="0.5883792650918636in"
height="0.23114938757655293in"})^4^; and (4) **Wayfinder_MPC_3Step**,
the full Wayfinder controller with 3-step receding-horizon MPC lookahead
(![](media/image116.png){width="1.4732294400699912in"
height="0.22986548556430447in"})^4^.

![](media/image115.png){width="4.625in" height="9.166666666666666in"}

### 7.2 Complete Monte Carlo Benchmark Results and Analysis

The table below reports the full breakdown across all five learner
archetypes and the cross-population summary averages from the simulation
benchmark^4^:

  --------------------------------- ------------------------- ------------ ------------ --------------- --------------- ------------------ -------------
  **Learner Archetype**             **Controller Policy**     **14-Day     **Context    **Residual      **Calibration   **Wheel-Spinning   **ETL per
                                                              Delayed      Transfer     Misconception   Brier Score**   Steps (%)**        Unit of
                                                              Mastery**    Score**      (μ\^​)**                                            Attention**

  **Calibrated**                    BKT_Threshold_SM2         0.187        0.053        0.195           0.267           87.5%              0.0018

  **Calibrated**                    IRT_85_Rule               0.187        0.053        0.195           0.278           87.5%              0.0018

  **Calibrated**                    Wayfinder_Greedy_1Step    0.408        0.365        0.079           0.212           21.1%              0.0134

  **Calibrated**                    **Wayfinder_MPC_3Step**   **0.435**    **0.394**    **0.075**       0.228           **19.6%**          **0.0146**

  **Misconception-Overconfident**   BKT_Threshold_SM2         0.178        0.052        0.458           0.428           87.5%              0.0015

  **Misconception-Overconfident**   IRT_85_Rule               0.178        0.052        0.460           0.451           87.5%              0.0015

  **Misconception-Overconfident**   Wayfinder_Greedy_1Step    0.406        0.357        0.189           0.221           17.0%              0.0132

  **Misconception-Overconfident**   **Wayfinder_MPC_3Step**   **0.446**    **0.406**    **0.182**       0.224           **9.4%**           **0.0150**

  **Wheel-Spinner**                 BKT_Threshold_SM2         0.149        0.049        0.421           0.402           100.0%             0.0007

  **Wheel-Spinner**                 IRT_85_Rule               0.149        0.049        0.418           0.396           100.0%             0.0007

  **Wheel-Spinner**                 Wayfinder_Greedy_1Step    0.403        0.372        0.179           0.229           19.6%              0.0135

  **Wheel-Spinner**                 **Wayfinder_MPC_3Step**   **0.438**    **0.409**    **0.172**       0.231           **14.7%**          **0.0151**

  **Underconfident Hint-Abuser**    BKT_Threshold_SM2         0.183        0.053        0.199           0.282           87.5%              0.0016

  **Underconfident Hint-Abuser**    IRT_85_Rule               0.183        0.053        0.205           0.267           87.5%              0.0016

  **Underconfident Hint-Abuser**    Wayfinder_Greedy_1Step    0.401        0.365        0.090           0.213           27.5%              0.0133

  **Underconfident Hint-Abuser**    **Wayfinder_MPC_3Step**   **0.440**    **0.401**    **0.085**       0.237           **19.9%**          **0.0151**

  **Rapid Forgetter**               BKT_Threshold_SM2         0.117        0.038        0.261           0.398           87.5%              -0.0004

  **Rapid Forgetter**               IRT_85_Rule               0.117        0.038        0.262           0.409           87.5%              -0.0004

  **Rapid Forgetter**               Wayfinder_Greedy_1Step    0.298        0.272        0.111           0.220           27.9%              0.0089

  **Rapid Forgetter**               **Wayfinder_MPC_3Step**   **0.328**    **0.303**    **0.105**       0.236           **21.6%**          **0.0102**

  **ALL ARCHETYPES (MEAN)**         BKT_Threshold_SM2         0.1628       0.0490       0.3068          0.3554          90.00%             0.0010

  **ALL ARCHETYPES (MEAN)**         IRT_85_Rule               0.1628       0.0490       0.3080          0.3602          90.00%             0.0010

  **ALL ARCHETYPES (MEAN)**         Wayfinder_Greedy_1Step    0.3832       0.3462       0.1296          **0.2190**      22.62%             0.0125

  **ALL ARCHETYPES (MEAN)**         **Wayfinder_MPC_3Step**   **0.4174**   **0.3826**   **0.1238**      0.2312          **17.04%**         **0.0140**
  --------------------------------- ------------------------- ------------ ------------ --------------- --------------- ------------------ -------------

Three core findings stand out from the simulation data. First, classical
BKT_Threshold_SM2 and IRT_85_Rule controllers spend 100.0% of their
steps wheel-spinning on the wheel_spinner archetype and yield negative
net transferable learning (-0.0004 ETL/UA) on the rapid_forgetter
archetype after a 14-day delay^4^. Because they only serve
standard_practice items and lack a foraging rule or
representation-switching mechanism, they trap the learner on early
skills where local patch depletion
(![](media/image50.png){width="2.1343536745406824in"
height="0.22905293088363954in"}) and active misconceptions
(![](media/image21.png){width="0.2227373140857393in"
height="0.2333442694663167in"}) throttle learning gains below the
forgetting rate^4^.

Second, combining the hypercorrection window with contrasting cases
eradicates persistent bugs. On the misconception_overconfident
archetype, baseline controllers leave residual misconceptions at
0.458--0.460 because standard practice errors do not dismantle the
underlying buggy rule^4^. Wayfinder detects the high-confidence error
signature (![](media/image104.png){width="1.360437445319335in"
height="0.22847003499562554in"}), deploys contrast_case interventions
during the hypercorrection window^15^, and reduces residual
misconceptions by 60.3% (down to 0.182) while cutting wheel-spinning to
9.4% of steps^4^.

Third, 3-step MPC lookahead provides a substantial performance gain over
1-step greedy foraging. While Wayfinder_Greedy_1Step captures the
initial leap over classical baselines by introducing variance-aware
beliefs, MVT foraging, and multimodal action types, Wayfinder_MPC_3Step
achieves a further **+8.9% relative increase in 14-day delayed mastery**
(0.4174 vs. 0.3832), a **+10.5% relative increase in context transfer**
(0.3826 vs. 0.3462), a **24.7% relative reduction in wheel-spinning**
(17.04% vs. 22.62%), and a **+12.0% boost in overall ETL per unit of
attention** (0.0140 vs. 0.0125)^4^. Lookahead planning prevents the
greedy controller from oscillating between patches or missing the
multi-step \"time for telling\" sequence (contrast_case
![](media/image27.png){width="0.21427384076990377in"
height="0.22447725284339456in"} worked_example_guided
![](media/image27.png){width="0.21427384076990377in"
height="0.22447725284339456in"} transfer_probe)^4^. Notice also a subtle
empirical trade-off: Wayfinder_MPC_3Step exhibits a slightly higher
rolling Brier score (0.2312 vs. 0.2190 for Greedy) because the 3-step
planner deliberately pushes learners into more ambitious transfer_probe
challenges across newly unlocked outer-fringe skills, temporarily
inducing productive prediction errors as learners stretch into novel
contexts^4^.

## 8. Engineering Implementation Roadmap: What to Build First (Wayfinder v1) & Guardrails

A frequent mistake in modern edtech engineering is attempting to cure
heuristic drift by training an end-to-end Deep Reinforcement Learning
(DRL) agent or Deep Knowledge Tracing (DKT) network on noisy historical
logs---an approach that requires massive sample sizes, lacks parameter
plausibility, and cannot explain its pedagogical trade-offs to learners
or authors^25^. Conversely, handing curriculum routing directly to a
conversational LLM invites sycophancy---where the AI prematurely gives
away answers to keep the user satisfied---and destroys prerequisite
accountability.

### 8.1 Seven-Stage Phased Implementation Plan for Wayfinder v1

The first production version of Wayfinder does not need a neural
network; it can be built as a **deterministic, approximate, and fully
explainable controller** across seven sequential stages^4^:

1.  **Keep BKT-Lite, but Add a Variance Estimate (Beta-BKT +
    Misconception Graph)**: Replace single mastery scalars in the
    learner state store with conjugate
    ![](media/image106.png){width="1.1449376640419948in"
    height="0.22898731408573927in"} parameter pairs (giving exact mean
    ![](media/image110.png){width="0.201334208223972in"
    height="0.23312445319335084in"} and epistemic variance
    ![](media/image32.png){width="0.21590223097112862in"
    height="0.2261832895888014in"}), an active misconception probability
    vector ![](media/image75.png){width="0.2227373140857393in"
    height="0.2333442694663167in"} mapped to authored distractor/bug
    tags^17^, and a temporal concentration decay function driven by
    elapsed time ![](media/image101.png){width="0.3494466316710411in"
    height="0.22611220472440946in"} and stability
    ![](media/image84.png){width="0.22493547681539808in"
    height="0.22493547681539808in"}^4^.

2.  **Add a Three-Step Lookahead Scorer Using the ETL/UA Objective**:
    Implement score_action_wayfinder and choose_action_wayfinder_mpc
    using a deterministic expected-belief transition model over horizon
    ![](media/image69.png){width="0.5883792650918636in"
    height="0.23114938757655293in"}^4^. Scoring 6 skills across 6 action
    modes evaluates 36 candidates at step 1, expands the top 5--6 beam
    branches at step 2, and scores the top 4 branches at step 3,
    requiring no neural network inference^4^.

3.  **Add a Marginal Value Foraging Rule for Leaving a Skill**: Track
    the exponentially weighted moving average of patch marginal learning
    rate ![](media/image65.png){width="2.272541557305337in"
    height="0.22933945756780402in"} and define the domain switching-cost
    matrix ![](media/image107.png){width="1.1953958880139983in"
    height="0.22868438320209974in"} over the curriculum DAG^1^. Fold
    spaced review directly into the same scorer as patch regeneration
    rather than running a competing review scheduler^4^.

4.  **Add a Productive-Surprise Band Using Confidence, Accuracy, and
    Latency**: Instrument the UI to capture a fast pre-submission
    confidence prediction
    ![](media/image10.png){width="0.1577143482064742in"
    height="0.2313145231846019in"} alongside item-level normalized
    response latency
    ![](media/image100.png){width="0.1645505249343832in"
    height="0.22625765529308836in"} and hint-opening timestamps^4^.
    Route the joint ![](media/image114.png){width="0.8494466316710412in"
    height="0.2279002624671916in"} signal through the four-quadrant
    Productive Surprise matrix (Section 4.3) to trigger contrast cases,
    guided worked examples, consolidation prompts, or scaffold
    fading^4^.

5.  **Add a Double-Loop Calibration and Agency Interface**: Expose the
    SMILI☺-compliant calibration graph (predicted confidence vs. actual
    performance over time) and the four learner policy modes (Explore,
    Consolidate, Challenge, Recover) in the student dashboard, logging
    learner overrides as Bayesian preference evidence rather than
    disobedience^4^.

6.  **Add Transfer Probes and Contrast Cases to the Content Schema**:
    Expand authoring templates so each skill patch includes at least one
    **side-by-side contrast case** targeting its primary misconception
    ![](media/image21.png){width="0.2227373140857393in"
    height="0.2333442694663167in"}^54^, one **guided worked example**
    with visible expert decision steps^24^, and one **far-transfer
    probe** set in a novel context^4^. Confine LLMs strictly to drafting
    candidate contrast cases, worked examples, and Socratic hints under
    the deterministic controller\'s authority.

7.  **Tune the Controller on Simulated Learners Before Live Piloting**:
    Run offline Monte Carlo sweeps across the five synthetic learner
    archetypes (calibrated, misconception_overconfident, wheel_spinner,
    underconfident_hint_abuser, and rapid_forgetter) to calibrate
    objective weights
    ![](media/image150.png){width="2.7364063867016624in"
    height="0.2289009186351706in"} and verify zero policy oscillation
    prior to classroom deployment^4^.

### 8.2 Architectural Guardrails: What Not to Do

To preserve the mathematical integrity and pedagogical accountability of
the engine over its lifecycle, engineering and product teams should
enforce six strict guardrails:

  ----------------------- ------------------------------------------------------- -------------------------------------------------------
  **Prohibited            **Failure Mechanism in Production**                     **Wayfinder Architectural Guardrail**
  Anti-Pattern**                                                                  

  **1. Do Not Add More    Patching edge cases with standalone if/else triggers    All new signals must enter as state variables in
  Independent             creates hidden priority collisions and policy drift.    ![](media/image127.png){width="0.2056474190726159in"
  Heuristics**                                                                    height="0.22621281714785652in"}, cost/value terms in
                                                                                  ![](media/image138.png){width="0.5299475065616798in"
                                                                                  height="0.22860454943132108in"}, or explicit
                                                                                  lexicographic constraints in the single MPC
                                                                                  controller^4^.

  **2. Do Not Let AI      Conversational LLMs optimize for immediate user         **AI cannot be the policy authority.** Keep the
  Choose the Path**       satisfaction and conversational coherence, leading to   Wayfinder controller deterministic and accountable; use
                          premature answer-giving and skipped prerequisites.      LLMs strictly to generate content and hints within the
                                                                                  chosen action mode.

  **3. Do Not Optimize    Extrinsic gamification (streaks, leaderboards, XP       Treat engagement strictly as a survivability constraint
  Engagement Alone**      counters) displaces intrinsic motivation, distorts      (frustration veto) and a small curiosity/option-value
                          feedback to self-level, and amplifies anxiety^53^.      bonus
                                                                                  (![](media/image90.png){width="0.37288385826771653in"
                                                                                  height="0.22787401574803148in"}), never the primary
                                                                                  objective^4^.

  **4. Do Not Reduce      A single difficulty parameter                           Maintain separate coordinates for **cognitive load**
  Difficulty to One       ![](media/image134.png){width="0.18375656167979001in"   (![](media/image59.png){width="0.4389643482064742in"
  Scalar**                height="0.22459098862642168in"} conflates intrinsic     height="0.2299332895888014in"}), **apprenticeship
                          cognitive load, problem ambiguity, scaffolding depth,   role/help** (Observer
                          and context transfer distance^24^.                      ![](media/image27.png){width="0.21427384076990377in"
                                                                                  height="0.22447725284339456in"} Guided
                                                                                  ![](media/image27.png){width="0.21427384076990377in"
                                                                                  height="0.22447725284339456in"} Independent),
                                                                                  **ambiguity**, and **transfer distance**
                                                                                  (![](media/image96.png){width="0.1714676290463692in"
                                                                                  height="0.23576771653543308in"})^4^.

  **5. Do Not Assume the  Hard-coding a static prerequisite tree prevents         Treat the KST surmise graph as extensible: allow
  Skill Graph Is Fixed**  learners and authors from bridging concepts organically authors and learners to attach new sub-patches,
                          or adding remediation patches^23^.                      contrast cases, and transfer links dynamically^23^.

  **6. Do Not Hide the    Silently switching topics or lowering item difficulty   **The explanation is part of the system.** Surface the
  Controller\'s           breeds learner distrust, confusion, and defensive       exact belief mismatch (e.g., confidence vs. accuracy or
  Trade-Off**             \"Model I\" gaming^63^.                                 patch depletion) in every transition banner^4^.
  ----------------------- ------------------------------------------------------- -------------------------------------------------------

#### Works cited

1.  Time to fly: A comparison of marginal value theorem approximations,
    [[https://repository.lsu.edu/cgi/viewcontent.cgi?article=1701&context=agrnr_pubs]{.underline}](https://repository.lsu.edu/cgi/viewcontent.cgi?article=1701&context=agrnr_pubs)

2.  Information Foraging Theory - Peter Pirolli,
    [[https://www.peterpirolli.com/ewExternalFiles/31354_C01_UNCORRECTED_PROOF.pdf]{.underline}](https://www.peterpirolli.com/ewExternalFiles/31354_C01_UNCORRECTED_PROOF.pdf)

3.  Faster Teaching via POMDP Planning - Patrick Shafto,
    [[https://shaftolab.com/assets/papers/rafferty2015.pdf]{.underline}](https://shaftolab.com/assets/papers/rafferty2015.pdf)

4.  [[unknown_url]{.underline}](http://docs.google.com/unknown_url)

5.  Unbounded Human Learning: Optimal Scheduling for Spaced,
    [[https://kdd.org/kdd2016/papers/files/rpp0744-reddyAT3.pdf]{.underline}](https://kdd.org/kdd2016/papers/files/rpp0744-reddyAT3.pdf)

6.  (PDF) Speed-Accuracy Response Models: Scoring Rules based on,
    [[https://www.researchgate.net/publication/268019650_Speed-Accuracy_Response_Models_Scoring_Rules_based_on_Response_Time_and_Accuracy]{.underline}](https://www.researchgate.net/publication/268019650_Speed-Accuracy_Response_Models_Scoring_Rules_based_on_Response_Time_and_Accuracy)

7.  Toward Meta-cognitive Tutoring: A Model of Help- Seeking with a,
    [[https://www.cs.cmu.edu/\~bmclaren/pubs/AlevenEtAl-TowardMetaCognitiveTutoring-IJAIED2006.pdf]{.underline}](https://www.cs.cmu.edu/~bmclaren/pubs/AlevenEtAl-TowardMetaCognitiveTutoring-IJAIED2006.pdf)

8.  Performance Factors Analysis -- A New Alternative to Knowledge,
    [[https://pact.cs.cmu.edu/koedinger/pubs/AIED%202009%20final%20Pavlik%20Cen%20Keodinger%20corrected.pdf]{.underline}](https://pact.cs.cmu.edu/koedinger/pubs/AIED%202009%20final%20Pavlik%20Cen%20Keodinger%20corrected.pdf)

9.  The Assessment of Knowledge in Theory and in Practice - ALEKS,
    [[https://www.aleks.com/about_aleks/Science_Behind_ALEKS.pdf]{.underline}](https://www.aleks.com/about_aleks/Science_Behind_ALEKS.pdf)

10. (PDF) Knowledge Spaces and Learning Spaces - ResearchGate,
    [[https://www.researchgate.net/publication/284579542_Knowledge_Spaces_and_Learning_Spaces]{.underline}](https://www.researchgate.net/publication/284579542_Knowledge_Spaces_and_Learning_Spaces)

11. Enhancing human learning via spaced repetition optimization - PMC,
    [[https://pmc.ncbi.nlm.nih.gov/articles/PMC6410796/]{.underline}](https://pmc.ncbi.nlm.nih.gov/articles/PMC6410796/)

12. The Eighty Five Percent Rule for optimal learning - ResearchGate,
    [[https://www.researchgate.net/publication/337036886_The_Eighty_Five_Percent_Rule_for_optimal_learning]{.underline}](https://www.researchgate.net/publication/337036886_The_Eighty_Five_Percent_Rule_for_optimal_learning)

13. (PDF) The Eighty Five Percent Rule for Optimal Learning,
    [[https://www.researchgate.net/publication/346858391_The_Eighty_Five_Percent_Rule_for_Optimal_Learning]{.underline}](https://www.researchgate.net/publication/346858391_The_Eighty_Five_Percent_Rule_for_Optimal_Learning)

14. Persistence or Wheel-Spinning? Problem Solving During,
    [[https://educationaldatamining.org/edm2026/proceedings/2026.EDM.poster-demo-papers.417/index.html]{.underline}](https://educationaldatamining.org/edm2026/proceedings/2026.EDM.poster-demo-papers.417/index.html)

15. The Hypercorrection Effect - Structural Learning,
    [[https://www.structural-learning.com/post/hypercorrection-effect-teachers-guide]{.underline}](https://www.structural-learning.com/post/hypercorrection-effect-teachers-guide)

16. Cognitive Apprenticeship: Methods and Evidence,
    [[https://en.cognitivepsychology.com/Cognitive_Apprenticeship]{.underline}](https://en.cognitivepsychology.com/Cognitive_Apprenticeship)

17. Diagno\$ing Bugs in a Simple Procedural Skill - Exquisitive,
    [[https://exquisitive.com/library/DiagnosingBugsSimpleProceduralSkill.pdf]{.underline}](https://exquisitive.com/library/DiagnosingBugsSimpleProceduralSkill.pdf)

18. Foraging Under Uncertainty Follows the Marginal Value Theorem,
    [[https://pmc.ncbi.nlm.nih.gov/articles/PMC10996644/]{.underline}](https://pmc.ncbi.nlm.nih.gov/articles/PMC10996644/)

19. Quantifying the Adaptive Value of Learning in Foraging Behavior,
    [[https://users.soe.ucsc.edu/\~msmangel/Eliassen%20et%20al%202009.pdf]{.underline}](https://users.soe.ucsc.edu/~msmangel/Eliassen%20et%20al%202009.pdf)

20. A Tutorial on Adaptive Design Optimization - Semantic Scholar,
    [[https://www.semanticscholar.org/paper/A-Tutorial-on-Adaptive-Design-Optimization-Myung-Cavagnaro/8f6fa6b60ddea3c8dedcce9244be4d8a19a64732]{.underline}](https://www.semanticscholar.org/paper/A-Tutorial-on-Adaptive-Design-Optimization-Myung-Cavagnaro/8f6fa6b60ddea3c8dedcce9244be4d8a19a64732)

21. (PDF) Adaptive Design Optimization: A Mutual Information-Based,
    [[https://www.researchgate.net/publication/40758728_Adaptive_Design_Optimization_A_Mutual_Information-Based_Approach_to_Model_Discrimination_in_Cognitive_Science]{.underline}](https://www.researchgate.net/publication/40758728_Adaptive_Design_Optimization_A_Mutual_Information-Based_Approach_to_Model_Discrimination_in_Cognitive_Science)

22. Intrinsic Motivation Systems for Autonomous Mental Development,
    [[http://www.pyoudeyer.com/ims.pdf]{.underline}](http://www.pyoudeyer.com/ims.pdf)

23. Intrinsic Motivation Systems for Autonomous Mental Development,
    [[https://scispace.com/papers/intrinsic-motivation-systems-for-autonomous-mental-a9mds7ef42]{.underline}](https://scispace.com/papers/intrinsic-motivation-systems-for-autonomous-mental-a9mds7ef42)

24. Cognitive Apprenticeship Explained \| PDF \| Expert - Scribd,
    [[https://www.scribd.com/document/459268529/Collins]{.underline}](https://www.scribd.com/document/459268529/Collins)

25. On the interpretability of deep learning based models for knowledge,
    [[https://s2.smu.edu/\~eclarson/pubs/2021_AAAI.pdf]{.underline}](https://s2.smu.edu/~eclarson/pubs/2021_AAAI.pdf)

26. (PDF) Unbounded Human Learning: Optimal Scheduling for Spaced,
    [[https://www.researchgate.net/publication/310824802_Unbounded_Human_Learning_Optimal_Scheduling_for_Spaced_Repetition]{.underline}](https://www.researchgate.net/publication/310824802_Unbounded_Human_Learning_Optimal_Scheduling_for_Spaced_Repetition)

27. Toward Meta-cognitive Tutoring: A Model of Help Seeking with a,
    [[https://www.researchgate.net/publication/220049859_Toward_Meta-cognitive_Tutoring_A_Model_of_Help_Seeking_with_a_Cognitive_Tutor]{.underline}](https://www.researchgate.net/publication/220049859_Toward_Meta-cognitive_Tutoring_A_Model_of_Help_Seeking_with_a_Cognitive_Tutor)

28. Performance Factors Analysis - A New Alternative to Knowledge,
    [[https://www.researchgate.net/publication/221297435_Performance_Factors_Analysis\_-\_A_New_Alternative_to_Knowledge_Tracing]{.underline}](https://www.researchgate.net/publication/221297435_Performance_Factors_Analysis_-_A_New_Alternative_to_Knowledge_Tracing)

29. Joseph Beck \| alphaXiv,
    [[https://www.alphaxiv.org/@joseph-beck]{.underline}](https://www.alphaxiv.org/@joseph-beck)

30. Logistic Knowledge Tracing and Performance Factors Analysis,
    [[https://yilinl.quarto.pub/pfa/]{.underline}](https://yilinl.quarto.pub/pfa/)

31. Why Deep Knowledge Tracing has less Depth than Anticipated - ERIC,
    [[https://files.eric.ed.gov/fulltext/ED599227.pdf]{.underline}](https://files.eric.ed.gov/fulltext/ED599227.pdf)

32. SMILI: A Framework for Interfaces to Learning Data in Open Learner,
    [[https://www.researchgate.net/publication/290507185_SMILI_A_Framework_for_Interfaces_to_Learning_Data_in_Open_Learner_Models_Learning_Analytics_and_Related_Fields]{.underline}](https://www.researchgate.net/publication/290507185_SMILI_A_Framework_for_Interfaces_to_Learning_Data_in_Open_Learner_Models_Learning_Analytics_and_Related_Fields)

33. Diagnostic Models for Procedural Bugs in Basic Mathematical
    Skills\*,
    [[https://exquisitive.com/library/DiagnosticModelsForProceduralBugs.pdf]{.underline}](https://exquisitive.com/library/DiagnosticModelsForProceduralBugs.pdf)

34. Susan Bull - alphaXiv,
    [[https://www.alphaxiv.org/@susan-bull]{.underline}](https://www.alphaxiv.org/@susan-bull)

35. GitHub - vanderbilt-data-science/knowledge-spaces: AI-powered,
    [[https://github.com/vanderbilt-data-science/knowledge-spaces]{.underline}](https://github.com/vanderbilt-data-science/knowledge-spaces)

36. Behavioral Science - Research Behind ALEKS,
    [[https://www.aleks.com/highered/behavior/research_behind_aleks]{.underline}](https://www.aleks.com/highered/behavior/research_behind_aleks)

37. Enhancing human learning via spaced repetition optimization - PNAS,
    [[https://www.pnas.org/doi/abs/10.1073/pnas.1815156116]{.underline}](https://www.pnas.org/doi/abs/10.1073/pnas.1815156116)

38. Multi-Armed Bandits for Intelligent Tutoring Systems - arXiv,
    [[https://arxiv.org/abs/1310.3174]{.underline}](https://arxiv.org/abs/1310.3174)

39. Multi-Armed Bandits for Intelligent Tutoring Systems,
    [[https://jedm.educationaldatamining.org/index.php/JEDM/article/view/JEDM111]{.underline}](https://jedm.educationaldatamining.org/index.php/JEDM/article/view/JEDM111)

40. Cognitive Apprenticeship Model: Six Methods and Examples,
    [[https://www.coursebox.ai/blog/cognitive-apprenticeship-model-of-teaching-and-its-use-in-elearning]{.underline}](https://www.coursebox.ai/blog/cognitive-apprenticeship-model-of-teaching-and-its-use-in-elearning)

41. Cognitive Apprenticeship: The Framework for Deeper Learning,
    [[https://www.timelygrader.ai/cognitive-apprenticeship]{.underline}](https://www.timelygrader.ai/cognitive-apprenticeship)

42. Anna Rafferty - Publications,
    [[https://sites.google.com/site/annanrafferty/publications]{.underline}](https://sites.google.com/site/annanrafferty/publications)

43. Optimal Scheduling for Spaced Repetition - Learning - ResearchGate,
    [[https://www.researchgate.net/publication/301844933_Unbounded_Human_Learning_Optimal_Scheduling_for_Spaced_Repetition]{.underline}](https://www.researchgate.net/publication/301844933_Unbounded_Human_Learning_Optimal_Scheduling_for_Spaced_Repetition)

44. Knowledge space - Wikipedia,
    [[https://en.wikipedia.org/wiki/Knowledge_space]{.underline}](https://en.wikipedia.org/wiki/Knowledge_space)

45. Learning Sequences - arXiv,
    [[https://arxiv.org/html/0803.4030v1]{.underline}](https://arxiv.org/html/0803.4030v1)

46. Speed-Accuracy Response Models: Scoring Rules based on,
    [[https://www.cambridge.org/core/journals/psychometrika/article/abs/speedaccuracy-response-models-scoring-rules-based-on-response-time-and-accuracy/50D600FD53437CF8AEB9505998CF263D]{.underline}](https://www.cambridge.org/core/journals/psychometrika/article/abs/speedaccuracy-response-models-scoring-rules-based-on-response-time-and-accuracy/50D600FD53437CF8AEB9505998CF263D)

47. Algorithms for the adaptive assessment of procedural knowledge,
    [[https://pmc.ncbi.nlm.nih.gov/articles/PMC10616228/]{.underline}](https://pmc.ncbi.nlm.nih.gov/articles/PMC10616228/)

48. Comparing Knowledge Tracing and Performance Factor Analysis by,
    [[https://web.cs.wpi.edu/\~nth/pubs_and_grants/ITS%202010/Gong%20Comparing%20Knowledge%20Tracing%20and%20Performance.pdf]{.underline}](https://web.cs.wpi.edu/~nth/pubs_and_grants/ITS%202010/Gong%20Comparing%20Knowledge%20Tracing%20and%20Performance.pdf)

49. 85% Rule of Optimal Learning - Medium,
    [[https://medium.com/@drenizerama/85-rule-of-optimal-learning-15581eca9842]{.underline}](https://medium.com/@drenizerama/85-rule-of-optimal-learning-15581eca9842)

50. The Eighty Five Percent "Rule" for Optimal Learning,
    [[https://aqrinternational.co.uk/the-eighty-five-percent-rule-for-optimal-learning-2]{.underline}](https://aqrinternational.co.uk/the-eighty-five-percent-rule-for-optimal-learning-2)

51. The Hypercorrection Effect: Why Confident Mistakes Stick - LEAI,
    [[https://leai.app/blog/hypercorrection-effect-why-confident-mistakes-stick]{.underline}](https://leai.app/blog/hypercorrection-effect-why-confident-mistakes-stick)

52. Errors committed with high confidence are hypercorrected - PubMed,
    [[https://pubmed.ncbi.nlm.nih.gov/11713883/]{.underline}](https://pubmed.ncbi.nlm.nih.gov/11713883/)

53. The 85% Rule, Not Gamification: Adaptive Difficulty \| IncluShift,
    [[https://inclushift.com/hub/briefs/eighty-five-percent-rule-not-gamification]{.underline}](https://inclushift.com/hub/briefs/eighty-five-percent-rule-not-gamification)

54. A Time for Telling - AAA Lab,
    [[https://aaalab.stanford.edu/papers/time_for_telling.pdf]{.underline}](https://aaalab.stanford.edu/papers/time_for_telling.pdf)

55. Charnov\'s marginal value theorem states that (a) the
    rate-maximizing,
    [[https://www.researchgate.net/figure/Charnovs-marginal-value-theorem-states-that-a-the-rate-maximizing-time-to-spend-in_fig5_229101074]{.underline}](https://www.researchgate.net/figure/Charnovs-marginal-value-theorem-states-that-a-the-rate-maximizing-time-to-spend-in_fig5_229101074)

56. Article Summary: Schwartz & Bransford (1998) A Time for Telling,
    [[https://laurenmarg.com/2023/05/03/article-summary-schwartz-bransford-1998-a-time-for-telling-constructivism/]{.underline}](https://laurenmarg.com/2023/05/03/article-summary-schwartz-bransford-1998-a-time-for-telling-constructivism/)

57. Faster Teaching via POMDP Planning - PubMed,
    [[https://pubmed.ncbi.nlm.nih.gov/26400190/]{.underline}](https://pubmed.ncbi.nlm.nih.gov/26400190/)

58. A Tutorial on Adaptive Design Optimization - PMC - NIH,
    [[https://pmc.ncbi.nlm.nih.gov/articles/PMC3755632/]{.underline}](https://pmc.ncbi.nlm.nih.gov/articles/PMC3755632/)

59. A Hierarchical Adaptive Approach to the Optimal Design of \... -
    AWS,
    [[https://mstrep.s3.amazonaws.com/publications/Kim_CogSci2014_Final.pdf]{.underline}](https://mstrep.s3.amazonaws.com/publications/Kim_CogSci2014_Final.pdf)

60. Errors committed with high confidence are hypercorrected.,
    [[https://www.semanticscholar.org/paper/Errors-committed-with-high-confidence-are-Butterfield-Metcalfe/cdbafcb94ae5bffc88b4aaf202cd7098a28c9473]{.underline}](https://www.semanticscholar.org/paper/Errors-committed-with-high-confidence-are-Butterfield-Metcalfe/cdbafcb94ae5bffc88b4aaf202cd7098a28c9473)

61. Cognitive Apprenticeship - DreamSpace Academy,
    [[https://dreamspace.academy/articles/definitions/cognitive-apprenticeship]{.underline}](https://dreamspace.academy/articles/definitions/cognitive-apprenticeship)

62. Argyris Single‑ and Double‑Loop Learning model,
    [[https://umbrex.com/resources/frameworks/organization-frameworks/argyris-single-and-double-loop-learning-model/]{.underline}](https://umbrex.com/resources/frameworks/organization-frameworks/argyris-single-and-double-loop-learning-model/)

63. chris argyris: theories of action, double-loop learning and,
    [[https://zeno-organisatieontwikkeling.nl/zeno/wp-content/uploads/2020/09/Argyris-C.-Theories-of-action-double-loop-learning-and-organizational-learning-revised-20-9-2011.pdf]{.underline}](https://zeno-organisatieontwikkeling.nl/zeno/wp-content/uploads/2020/09/Argyris-C.-Theories-of-action-double-loop-learning-and-organizational-learning-revised-20-9-2011.pdf)

64. Learning Theories: Double-Loop Learning \| TeachThought,
    [[https://www.teachthought.com/learning-posts/learning-theories-double-loop-learning/]{.underline}](https://www.teachthought.com/learning-posts/learning-theories-double-loop-learning/)

65. Open learner model - EduTech Wiki,
    [[https://edutechwiki.unige.ch/en/Open_learner_model]{.underline}](https://edutechwiki.unige.ch/en/Open_learner_model)

66. Double Loop Learning in Organizations,
    [[https://theisrm.org/documents/Argyris%20(1977)%20Double%20Loop%20Learning%20in%20Organizations.pdf]{.underline}](https://theisrm.org/documents/Argyris%20(1977)%20Double%20Loop%20Learning%20in%20Organizations.pdf)

67. (PDF) Open Learner Models - ResearchGate,
    [[https://www.researchgate.net/publication/226516577_Open_Learner_Models]{.underline}](https://www.researchgate.net/publication/226516577_Open_Learner_Models)

68. Publications - Emma Brunskill,
    [[https://cs.stanford.edu/people/ebrun/publications.html]{.underline}](https://cs.stanford.edu/people/ebrun/publications.html)
