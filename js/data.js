/**
 * AgPlacify Data Store
 * Comprehensive Domain Knowledge Base, Diagnostic Quizzes, Roadmaps, Resources, and Assessments.
 */

window.PLACIFY_DATA = {
  domains: [
    {
      id: 'fullstack',
      name: 'Full-Stack Web Development',
      icon: 'ph-code-block',
      description: 'Master Modern Web Architecture: HTML/CSS, React, Node.js, Databases, and System Design.',
      diagnostics: [
        {
          id: 'fs_q1',
          question: 'What is the primary difference between `var`, `let`, and `const` in JavaScript?',
          options: [
            'No difference, they are interchangeable syntax variants.',
            '`var` is function-scoped; `let` and `const` are block-scoped.',
            '`const` allows variable re-assignment, while `let` locks the reference.',
            '`let` hoisting creates a global scope polluter in browser environments.'
          ],
          correct: 1,
          topic: 'JavaScript Fundamentals',
          prerequisiteFor: 'Advanced Async JS'
        },
        {
          id: 'fs_q2',
          question: 'Which HTTP method is idempotent and used to replace an entire target resource?',
          options: ['POST', 'PATCH', 'PUT', 'DELETE'],
          correct: 2,
          topic: 'REST API & HTTP Protocols',
          prerequisiteFor: 'Backend API Design'
        },
        {
          id: 'fs_q3',
          question: 'What happens during the React Virtual DOM Reconciliation process?',
          options: [
            'The entire browser DOM is re-rendered on every state update.',
            'React computes a diff between the old VDOM and new VDOM to perform minimal real DOM updates.',
            'State updates are serialized directly to localStorage for offline persistence.',
            'React converts JSX directly into WebAssembly binary instructions.'
          ],
          correct: 1,
          topic: 'React & UI Architecture',
          prerequisiteFor: 'State Management & Next.js'
        },
        {
          id: 'fs_q4',
          question: 'What is an ACID transaction property in SQL databases?',
          options: [
            'Asynchronous, Concurrent, Indexed, Distributed',
            'Atomicity, Consistency, Isolation, Durability',
            'Analytical, Columnar, In-memory, Data-lake',
            'Authentication, Cipher, Inspection, Decryption'
          ],
          correct: 1,
          topic: 'Database Management',
          prerequisiteFor: 'Production Data Modeling'
        },
        {
          id: 'fs_q5',
          question: 'What mechanism prevents Cross-Site Scripting (XSS) attacks in modern web apps?',
          options: [
            'Disabling HTTP cookies completely.',
            'Sanitizing/escaping user inputs, implementing Content Security Policy (CSP), and avoiding unsafe innerHTML.',
            'Using CORS headers on every public endpoint.',
            'Encrypting frontend bundles with Webpack obfuscators.'
          ],
          correct: 1,
          topic: 'Web Security',
          prerequisiteFor: 'Secure Enterprise Systems'
        }
      ],
      milestones: [
        { id: 'm1', title: 'Phase 1: Web Foundations & Modern JS (ES6+)', topic: 'JavaScript Fundamentals', week: 1, durationDays: 7 },
        { id: 'm2', title: 'Phase 2: Frontend Engineering with React & Tailwind', topic: 'React & UI Architecture', week: 2, durationDays: 7 },
        { id: 'm3', title: 'Phase 3: Backend API Architecture (Node.js & Express)', topic: 'REST API & HTTP Protocols', week: 3, durationDays: 7 },
        { id: 'm4', title: 'Phase 4: Database Design (PostgreSQL & MongoDB)', topic: 'Database Management', week: 4, durationDays: 7 },
        { id: 'm5', title: 'Phase 5: Web Security, Performance & Auth', topic: 'Web Security', week: 5, durationDays: 7 },
        { id: 'm6', title: 'Phase 6: Full-Stack Integration & Deployment (Vercel/Docker)', topic: 'System Design', week: 6, durationDays: 7 }
      ]
    },
    {
      id: 'datascience',
      name: 'Data Science & Machine Learning',
      icon: 'ph-brain',
      description: 'From Exploratory Data Analysis (EDA) & Machine Learning algorithms to Deep Learning & MLOps.',
      diagnostics: [
        {
          id: 'ds_q1',
          question: 'What is the key difference between Supervised and Unsupervised Learning?',
          options: [
            'Supervised learning requires human code review; unsupervised uses AI agents.',
            'Supervised learning uses labeled training datasets; unsupervised finds patterns in unlabeled data.',
            'Supervised learning only runs on GPUs; unsupervised runs on CPUs.',
            'Supervised learning is reserved for regression; unsupervised is reserved for time-series.'
          ],
          correct: 1,
          topic: 'Machine Learning Basics',
          prerequisiteFor: 'Supervised Models'
        },
        {
          id: 'ds_q2',
          question: 'What does the Bias-Variance tradeoff describe in model performance?',
          options: [
            'Tradeoff between training speed and memory usage.',
            'Overfitting (high variance) vs Underfitting (high bias) when generalizing to unseen data.',
            'Accuracy of linear regression vs decision trees.',
            'Data clean-up speed vs feature engineering depth.'
          ],
          correct: 1,
          topic: 'Model Evaluation & Optimization',
          prerequisiteFor: 'Advanced Ensemble Methods'
        },
        {
          id: 'ds_q3',
          question: 'Which metric is best suited for evaluating a model on a highly imbalanced classification dataset?',
          options: ['Accuracy', 'Precision-Recall / F1-Score', 'Mean Squared Error (MSE)', 'R-Squared Score'],
          correct: 1,
          topic: 'Data Preprocessing & Metrics',
          prerequisiteFor: 'Real-world Model Auditing'
        },
        {
          id: 'ds_q4',
          question: 'What is the activation function commonly used in deep neural network hidden layers to mitigate vanishing gradients?',
          options: ['Sigmoid', 'Tanh', 'ReLU (Rectified Linear Unit)', 'Step Function'],
          correct: 2,
          topic: 'Deep Learning Architectures',
          prerequisiteFor: 'Neural Networks & PyTorch'
        },
        {
          id: 'ds_q5',
          question: 'What principal technique does Principal Component Analysis (PCA) perform?',
          options: [
            'Dimensionality reduction by finding orthogonal axes of maximum variance.',
            'Clustering data points into k distinct centroids.',
            'Hyperparameter tuning using grid search.',
            'Natural Language Processing tokenization.'
          ],
          correct: 0,
          topic: 'Unsupervised Learning & PCA',
          prerequisiteFor: 'Feature Reduction'
        }
      ],
      milestones: [
        { id: 'm1', title: 'Phase 1: Python Data Stack (NumPy, Pandas, Matplotlib)', topic: 'Data Preprocessing & Metrics', week: 1, durationDays: 7 },
        { id: 'm2', title: 'Phase 2: Supervised Learning (Linear, Logistic, Tree Ensembles)', topic: 'Machine Learning Basics', week: 2, durationDays: 7 },
        { id: 'm3', title: 'Phase 3: Model Tuning & Evaluation Metrics', topic: 'Model Evaluation & Optimization', week: 3, durationDays: 7 },
        { id: 'm4', title: 'Phase 4: Unsupervised Learning & Clustering', topic: 'Unsupervised Learning & PCA', week: 4, durationDays: 7 },
        { id: 'm5', title: 'Phase 5: Deep Learning Foundations (PyTorch/TensorFlow)', topic: 'Deep Learning Architectures', week: 5, durationDays: 7 },
        { id: 'm6', title: 'Phase 6: Model Deployment & MLOps Pipelines', topic: 'MLOps', week: 6, durationDays: 7 }
      ]
    },
    {
      id: 'dsa',
      name: 'Data Structures & Algorithms (Interview Prep)',
      icon: 'ph-tree-structure',
      description: 'Master coding patterns: Arrays, Sliding Window, Trees, Graphs, Dynamic Programming, and System Design.',
      diagnostics: [
        {
          id: 'dsa_q1',
          question: 'What is the time complexity of searching an element in a balanced Binary Search Tree (BST)?',
          options: ['O(1)', 'O(log N)', 'O(N)', 'O(N log N)'],
          correct: 1,
          topic: 'Trees & Search Algorithms',
          prerequisiteFor: 'Advanced Tree Structures'
        },
        {
          id: 'dsa_q2',
          question: 'Which data structure follows the Last-In, First-Out (LIFO) principle?',
          options: ['Queue', 'Stack', 'Linked List', 'Max Heap'],
          correct: 1,
          topic: 'Basic Data Structures',
          prerequisiteFor: 'DFS & Backtracking'
        },
        {
          id: 'dsa_q3',
          question: 'What pattern is ideal for finding the maximum sum of a contiguous subarray of size K?',
          options: ['Two Pointers', 'Sliding Window', 'Binary Search', 'Topological Sort'],
          correct: 1,
          topic: 'Subarray & String Patterns',
          prerequisiteFor: 'Advanced Array Optimization'
        },
        {
          id: 'dsa_q4',
          question: 'What traversal strategy is used by Dijkstra\'s algorithm to find the shortest path in a weighted graph?',
          options: ['Depth-First Search (DFS)', 'Breadth-First Search (BFS) with Priority Queue / Min-Heap', 'Linear Search', 'Pre-order Traversal'],
          correct: 1,
          topic: 'Graph Algorithms',
          prerequisiteFor: 'Complex Network Routing'
        },
        {
          id: 'dsa_q5',
          question: 'What defines a problem solvable by Dynamic Programming (DP)?',
          options: [
            'Random input distribution and prime factors.',
            'Overlapping subproblems and optimal substructure.',
            'Strict sorted order and hash collisions.',
            'Constant memory footprint requirement.'
          ],
          correct: 1,
          topic: 'Dynamic Programming',
          prerequisiteFor: 'Advanced DP Mastery'
        }
      ],
      milestones: [
        { id: 'm1', title: 'Phase 1: Arrays, Hash Maps, & Two Pointers', topic: 'Basic Data Structures', week: 1, durationDays: 7 },
        { id: 'm2', title: 'Phase 2: Sliding Window & Fast/Slow Pointers', topic: 'Subarray & String Patterns', week: 2, durationDays: 7 },
        { id: 'm3', title: 'Phase 3: Stacks, Queues, & Binary Search', topic: 'Basic Data Structures', week: 3, durationDays: 7 },
        { id: 'm4', title: 'Phase 4: Trees, BSTs, & BFS/DFS Traversals', topic: 'Trees & Search Algorithms', week: 4, durationDays: 7 },
        { id: 'm5', title: 'Phase 5: Graph Theory, Topological Sort, & Shortest Path', topic: 'Graph Algorithms', week: 5, durationDays: 7 },
        { id: 'm6', title: 'Phase 6: Dynamic Programming Patterns (1D & 2D)', topic: 'Dynamic Programming', week: 6, durationDays: 7 }
      ]
    },
    {
      id: 'devops',
      name: 'Cloud Engineering & DevOps',
      icon: 'ph-cloud-tower',
      description: 'Master Cloud Infrastructure: Linux, Docker, Kubernetes, Terraform, CI/CD, and Observability.',
      diagnostics: [
        {
          id: 'dev_q1',
          question: 'What is the primary benefit of containerization (e.g. Docker) over traditional Virtual Machines (VMs)?',
          options: [
            'Containers include full guest operating systems.',
            'Containers share the host OS kernel, resulting in lightweight, fast-starting isolated environments.',
            'Containers eliminate the need for networking config.',
            'Containers run exclusively on cloud hypervisors.'
          ],
          correct: 1,
          topic: 'Containerization',
          prerequisiteFor: 'Kubernetes Orchestration'
        },
        {
          id: 'dev_q2',
          question: 'What is Infrastructure as Code (IaC) with tools like Terraform?',
          options: [
            'Writing bash scripts directly on production servers.',
            'Defining and provisioning cloud infrastructure declaratively using code files managed in version control.',
            'Compiling C++ code into Cloud Assembly modules.',
            'Auto-scaling servers using AI prompt generators.'
          ],
          correct: 1,
          topic: 'Infrastructure as Code',
          prerequisiteFor: 'Multi-Cloud Architecture'
        },
        {
          id: 'dev_q3',
          question: 'What is the role of a Kubernetes Ingress Controller?',
          options: [
            'Configuring container CPU usage limits.',
            'Managing external access to services in a cluster, typically HTTP/HTTPS routing.',
            'Encrypting hard drives on cluster nodes.',
            'Compiling container images from Dockerfiles.'
          ],
          correct: 1,
          topic: 'Kubernetes Orchestration',
          prerequisiteFor: 'Production Cluster Operations'
        },
        {
          id: 'dev_q4',
          question: 'In CI/CD pipelines, what is the key difference between Continuous Delivery and Continuous Deployment?',
          options: [
            'Delivery automated builds only; Deployment automates unit testing.',
            'Delivery ensures code is always ready for release with manual trigger; Deployment automatically deploys every passed change to production.',
            'Delivery uses Jenkins; Deployment uses GitHub Actions.',
            'Delivery requires Docker; Deployment requires Kubernetes.'
          ],
          correct: 1,
          topic: 'CI/CD Pipelines',
          prerequisiteFor: 'GitOps Workflow'
        },
        {
          id: 'dev_q5',
          question: 'Which key metric triad defines cloud application Observability?',
          options: [
            'HTML, CSS, JavaScript',
            'Logs, Metrics, Traces',
            'CPU, RAM, Disk',
            'Build, Test, Deploy'
          ],
          correct: 1,
          topic: 'Observability & Monitoring',
          prerequisiteFor: 'SRE & Reliability'
        }
      ],
      milestones: [
        { id: 'm1', title: 'Phase 1: Linux Administration & Shell Scripting', topic: 'Linux Basics', week: 1, durationDays: 7 },
        { id: 'm2', title: 'Phase 2: Docker Containerization & Multi-stage Builds', topic: 'Containerization', week: 2, durationDays: 7 },
        { id: 'm3', title: 'Phase 3: CI/CD Pipelines (GitHub Actions & GitLab CI)', topic: 'CI/CD Pipelines', week: 3, durationDays: 7 },
        { id: 'm4', title: 'Phase 4: Kubernetes Orchestration & Helm Charts', topic: 'Kubernetes Orchestration', week: 4, durationDays: 7 },
        { id: 'm5', title: 'Phase 5: Terraform & Cloud Provisioning (AWS/GCP)', topic: 'Infrastructure as Code', week: 5, durationDays: 7 },
        { id: 'm6', title: 'Phase 6: Observability with Prometheus, Grafana & Jaeger', topic: 'Observability & Monitoring', week: 6, durationDays: 7 }
      ]
    }
  ],

  resources: {
    'BEGINNER': [
      {
        title: 'Interactive Conceptual Foundation Guide',
        type: 'Interactive Guide',
        estTime: '25 mins',
        url: 'https://developer.mozilla.org',
        author: 'Placify Academy',
        summary: 'Step-by-step beginner breakdown with visual diagrams, code playpens, and plain-English analogies.'
      },
      {
        title: 'Visual Core Concepts Video Lecture & Walkthrough',
        type: 'Video Tutorial',
        estTime: '30 mins',
        url: 'https://youtube.com',
        author: 'Tech Academy Labs',
        summary: 'High-yield 1080p crash course explaining fundamentals with live coding demonstrations.'
      },
      {
        title: 'Hands-on Starter Exercise & Code Sandbox',
        type: 'Hands-on Lab',
        estTime: '35 mins',
        url: 'https://codesandbox.io',
        author: 'Interactive Dev',
        summary: 'Guided interactive coding challenge with automated linting and immediate error explanations.'
      }
    ],
    'INTERMEDIATE': [
      {
        title: 'Deep Dive Architectural Specification & Patterns',
        type: 'Technical Article',
        estTime: '30 mins',
        url: 'https://martinfowler.com',
        author: 'Industry Lead Engineers',
        summary: 'Comprehensive analysis of production design patterns, performance optimizations, and trade-offs.'
      },
      {
        title: 'Intermediate Hands-On Lab & Refactoring Task',
        type: 'Interactive Lab',
        estTime: '45 mins',
        url: 'https://github.com',
        author: 'Placify Engineering',
        summary: 'Refactor legacy snippets to adhere to clean code principles, high concurrency, and proper error boundaries.'
      },
      {
        title: 'Production Case Study & Benchmark Review',
        type: 'Case Study',
        estTime: '25 mins',
        url: 'https://blog.cloudflare.com',
        author: 'Cloudflare / Netlify Engineering',
        summary: 'Real-world engineering incident response breakdown and performance tuning under high load.'
      }
    ],
    'ADVANCED': [
      {
        title: 'Advanced System Architecture & Scalability Blueprint',
        type: 'Whitepaper / Specs',
        estTime: '40 mins',
        url: 'https://arxiv.org',
        author: 'Principal Systems Architect',
        summary: 'Distributed consensus, zero-downtime migrations, memory management, and microservice mesh setups.'
      },
      {
        title: 'Hard Core Optimization & Security Hardening Lab',
        type: 'Advanced Challenge',
        estTime: '50 mins',
        url: 'https://leetcode.com',
        author: 'Placify RedTeam & Core',
        summary: 'Stress-test code under high concurrency, fix race conditions, and audit memory leak tracebacks.'
      }
    ]
  },

  conceptAssessments: {
    'JavaScript Fundamentals': [
      {
        question: 'Which output is produced by `console.log(typeof NaN)`?',
        options: ['"number"', '"nan"', '"undefined"', '"object"'],
        correct: 0,
        explanation: 'In JavaScript, `NaN` (Not-a-Number) is technically a numeric data type property defined under IEEE 754 floating-point math.'
      },
      {
        question: 'What is the result of `[1, 2, 3] + [4, 5]` in JavaScript?',
        options: ['[1, 2, 3, 4, 5]', '"1,2,34,5"', 'TypeError', 'NaN'],
        correct: 1,
        explanation: 'The `+` operator coerces both arrays into string representations (`"1,2,3"` and `"4,5"`), yielding `"1,2,34,5"`.'
      },
      {
        question: 'How does Event Loop handle Promises compared to `setTimeout` callbacks?',
        options: [
          'Promises are pushed to Microtask Queue (higher priority); setTimeout callbacks go to Macrotask Queue.',
          'setTimeout has higher priority than Promises.',
          'Both are executed simultaneously on worker threads.',
          'Promises block the main thread synchronously.'
        ],
        correct: 0,
        explanation: 'Microtasks (Promises, process.nextTick) run immediately after current synchronous script execution before the next Macrotask (setTimeout, setInterval).'
      }
    ],
    'React & UI Architecture': [
      {
        question: 'Why should you never mutate React state variables directly (e.g. `state.count = 5`)?',
        options: [
          'It throws a syntax error at compile time.',
          'React relies on shallow reference equality checks; direct mutation does not trigger component re-renders.',
          'It deletes the state variable from RAM.',
          'It causes browser memory leaks.'
        ],
        correct: 1,
        explanation: 'React compares state snapshots using Object.is. Mutating state objects in place keeps the reference unchanged, so React skips re-rendering.'
      },
      {
        question: 'When should `useCallback` be used in a React component?',
        options: [
          'To run side-effects on initial render only.',
          'To memoize callback functions passed to optimized child components to prevent unnecessary re-renders.',
          'To fetch data from backend REST APIs.',
          'To replace Redux global state store.'
        ],
        correct: 1,
        explanation: 'useCallback caches a function instance between renders unless specified dependencies change, preventing prop reference changes for child components.'
      },
      {
        question: 'What is the purpose of the `key` prop when rendering dynamic lists in React?',
        options: [
          'It styles the list item with CSS rules.',
          'It helps React identify which items have changed, been added, or removed during DOM diffing.',
          'It acts as an encryption key for secure client storage.',
          'It binds the item to database primary keys automatically.'
        ],
        correct: 1,
        explanation: 'Keys give list items persistent identities, allowing React to optimize VDOM diffing and avoid destroying/recreating DOM nodes incorrectly.'
      }
    ],
    'Default': [
      {
        question: 'What is the main goal of applying modular design principles in software engineering?',
        options: [
          'To reduce code file size by 90%.',
          'To isolate responsibilities, promote reusability, lower coupling, and simplify testing.',
          'To enforce single-threaded execution.',
          'To remove all third-party dependencies.'
        ],
        correct: 1,
        explanation: 'Modular design separates code into distinct, self-contained units with well-defined APIs, improving maintainability and testability.'
      },
      {
        question: 'What does continuous integration (CI) verify in automated development pipelines?',
        options: [
          'That user passwords are encrypted.',
          'That newly merged code passes automated build steps, linter checks, and unit tests.',
          'That DNS servers resolve in under 1ms.',
          'That all marketing analytics tags are present.'
        ],
        correct: 1,
        explanation: 'CI automatically validates code changes against automated test suites to catch regressions early before deployment.'
      },
      {
        question: 'Why are automated unit tests crucial during refactoring?',
        options: [
          'They speed up CPU clock cycles.',
          'They ensure existing business logic and contracts remain unbroken while code structure is improved.',
          'They eliminate the need for code review.',
          'They compile JavaScript into C++ binary binaries.'
        ],
        correct: 1,
        explanation: 'Unit tests act as a safety net, confirming that external behavior remains identical while internal code quality is elevated.'
      }
    ]
  }
};
