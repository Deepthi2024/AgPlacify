/**
 * Knowledge Graph Engine for AgPlacify
 * Domain-independent, prerequisite-aware skill graph structure supporting arbitrary domains.
 * Hierarchy: Domain -> Topics -> Subtopics -> Skills/Concepts -> Subskills -> (Prerequisites, Difficulty, Learning Dependencies)
 */

const DOMAIN_KNOWLEDGE_GRAPHS = {
  fullstack: {
    domainId: 'fullstack',
    domainName: 'Full-Stack Web Development',
    topics: [
      {
        id: 'fs_top_web_fund',
        name: 'Web & HTML/CSS Fundamentals',
        subtopics: [
          {
            id: 'fs_sub_html',
            name: 'HTML5 Foundations',
            skills: [
              {
                skillId: 'web_html_elem',
                skillName: 'HTML5 Semantic Elements',
                prerequisites: [],
                difficulty: 'BEGINNER',
                estimatedHours: 3,
                subskills: [
                  { subskillId: 'html_doc_struct', subskillName: 'HTML Document Structure & Boilerplate', prerequisites: [], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: 'html_text_formatting', subskillName: 'Headings, Paragraphs & Text Formatting', prerequisites: ['html_doc_struct'], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: 'html_links_nav', subskillName: 'Links, Hyperlinks & Navigation Anchor Tags', prerequisites: ['html_text_formatting'], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: 'html_images_media', subskillName: 'Images, Audio & Embedded Media', prerequisites: ['html_links_nav'], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: 'html_lists_tables', subskillName: 'Ordered, Unordered Lists & Data Tables', prerequisites: ['html_images_media'], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: 'html_forms_inputs', subskillName: 'Forms, Input Controls & Label Attributes', prerequisites: ['html_lists_tables'], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: 'html_semantic_a11y', subskillName: 'Semantic Elements & ARIA Accessibility', prerequisites: ['html_forms_inputs'], difficulty: 'BEGINNER', estimatedMinutes: 45 }
                ]
              }
            ]
          },
          {
            id: 'fs_sub_css',
            name: 'CSS Layouts',
            skills: [
              {
                skillId: 'web_css_box',
                skillName: 'CSS Box Model & Flexbox',
                prerequisites: ['web_html_elem'],
                difficulty: 'BEGINNER',
                estimatedHours: 4,
                subskills: [
                  { subskillId: 'css_selectors_rules', subskillName: 'CSS Selectors, Specificity & Cascade', prerequisites: [], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: 'css_box_model', subskillName: 'Box Model: Margin, Border, Padding & Sizing', prerequisites: ['css_selectors_rules'], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: 'css_flex_container', subskillName: 'Flexbox Container & Main/Cross Axis', prerequisites: ['css_box_model'], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: 'css_flex_items', subskillName: 'Flex Items Alignment, Grow & Shrink', prerequisites: ['css_flex_container'], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: 'css_positioning', subskillName: 'CSS Positioning: Relative, Absolute & Fixed', prerequisites: ['css_flex_items'], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: 'css_typography_colors', subskillName: 'Color Systems, Fonts & Web Typography', prerequisites: ['css_positioning'], difficulty: 'BEGINNER', estimatedMinutes: 45 }
                ]
              },
              {
                skillId: 'web_css_grid',
                skillName: 'CSS Grid & Responsive Layouts',
                prerequisites: ['web_css_box'],
                difficulty: 'BEGINNER',
                estimatedHours: 4,
                subskills: [
                  { subskillId: 'css_grid_template', subskillName: 'Grid Container & Template Tracks', prerequisites: [], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: 'css_grid_placement', subskillName: 'Grid Item Placement & Span Alignment', prerequisites: ['css_grid_template'], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: 'css_media_queries', subskillName: 'Media Queries & Breakpoint Strategy', prerequisites: ['css_grid_placement'], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: 'css_responsive_units', subskillName: 'Responsive Units (rem, em, vw, vh, fr)', prerequisites: ['css_media_queries'], difficulty: 'BEGINNER', estimatedMinutes: 45 }
                ]
              }
            ]
          }
        ]
      },
      {
        id: 'fs_top_js_fund',
        name: 'JavaScript Fundamentals',
        subtopics: [
          {
            id: 'fs_sub_js_syntax',
            name: 'JavaScript Core Syntax',
            skills: [
              {
                skillId: 'js_vars_types',
                skillName: 'JS Variables, Types & Operators',
                prerequisites: ['web_css_box'],
                difficulty: 'BEGINNER',
                estimatedHours: 4,
                subskills: [
                  { subskillId: 'js_vars_const_let', subskillName: 'Variables: var, let & const Scoping', prerequisites: [], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: 'js_primitive_types', subskillName: 'Primitive Types: String, Number, Boolean, null', prerequisites: ['js_vars_const_let'], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: 'js_operators_math', subskillName: 'Arithmetic, Comparison & Logical Operators', prerequisites: ['js_primitive_types'], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: 'js_type_conversion', subskillName: 'Explicit & Implicit Type Coercion', prerequisites: ['js_operators_math'], difficulty: 'BEGINNER', estimatedMinutes: 45 }
                ]
              },
              {
                skillId: 'js_control_flow',
                skillName: 'Control Flow, Loops & Conditionals',
                prerequisites: ['js_vars_types'],
                difficulty: 'BEGINNER',
                estimatedHours: 4,
                subskills: [
                  { subskillId: 'js_if_else_branch', subskillName: 'Conditional Logic: if, else if, switch', prerequisites: [], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: 'js_for_while_loops', subskillName: 'Loops: for, while & do...while Iteration', prerequisites: ['js_if_else_branch'], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: 'js_break_continue', subskillName: 'Loop Control: break & continue Rules', prerequisites: ['js_for_while_loops'], difficulty: 'BEGINNER', estimatedMinutes: 45 }
                ]
              }
            ]
          },
          {
            id: 'fs_sub_js_funcs',
            name: 'Functions & Objects',
            skills: [
              {
                skillId: 'js_funcs_scope',
                skillName: 'JS Functions, Scope & Closures',
                prerequisites: ['js_control_flow'],
                difficulty: 'BEGINNER',
                estimatedHours: 5,
                subskills: [
                  { subskillId: 'js_func_decl_expr', subskillName: 'Function Declarations & Expressions', prerequisites: [], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: 'js_arrow_functions', subskillName: 'Arrow Functions & Lexical Scope', prerequisites: ['js_func_decl_expr'], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: 'js_scope_closures', subskillName: 'Global/Local Scope & Closures', prerequisites: ['js_arrow_functions'], difficulty: 'BEGINNER', estimatedMinutes: 45 }
                ]
              },
              {
                skillId: 'js_arrays_objs',
                skillName: 'JS Arrays, Objects & ES6+ Features',
                prerequisites: ['js_funcs_scope'],
                difficulty: 'BEGINNER',
                estimatedHours: 5,
                subskills: [
                  { subskillId: 'js_array_methods', skillName: 'Array Iteration: map, filter, reduce', prerequisites: [], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: 'js_object_literals', skillName: 'Object Literals, Keys & Destructuring', prerequisites: ['js_array_methods'], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: 'js_spread_rest', skillName: 'Spread/Rest Operators & Template Literals', prerequisites: ['js_object_literals'], difficulty: 'BEGINNER', estimatedMinutes: 45 }
                ]
              }
            ]
          }
        ]
      },
      {
        id: 'fs_top_dom_async',
        name: 'DOM & Async JavaScript',
        subtopics: [
          {
            id: 'fs_sub_dom',
            name: 'DOM Manipulation',
            skills: [
              {
                skillId: 'js_dom_events',
                skillName: 'DOM Selection & Event Handling',
                prerequisites: ['js_arrays_objs'],
                difficulty: 'INTERMEDIATE',
                estimatedHours: 5,
                subskills: [
                  { subskillId: 'dom_query_selectors', subskillName: 'DOM Element Selection & Querying', prerequisites: [], difficulty: 'INTERMEDIATE', estimatedMinutes: 45 },
                  { subskillId: 'dom_element_mutation', subskillName: 'Modifying Text, HTML & Attributes', prerequisites: ['dom_query_selectors'], difficulty: 'INTERMEDIATE', estimatedMinutes: 45 },
                  { subskillId: 'dom_event_listeners', subskillName: 'Event Listeners, Bubbling & Delegation', prerequisites: ['dom_element_mutation'], difficulty: 'INTERMEDIATE', estimatedMinutes: 45 }
                ]
              }
            ]
          },
          {
            id: 'fs_sub_async',
            name: 'Async JS & HTTP',
            skills: [
              {
                skillId: 'js_promises_async',
                skillName: 'Promises & Async/Await',
                prerequisites: ['js_dom_events'],
                difficulty: 'INTERMEDIATE',
                estimatedHours: 6,
                subskills: [
                  { subskillId: 'js_callbacks_promises', skillName: 'Callbacks vs Promises Resolution', prerequisites: [], difficulty: 'INTERMEDIATE', estimatedMinutes: 45 },
                  { subskillId: 'js_async_await_syntax', skillName: 'Async/Await Syntax & Error Handling', prerequisites: ['js_callbacks_promises'], difficulty: 'INTERMEDIATE', estimatedMinutes: 45 }
                ]
              },
              {
                skillId: 'js_fetch_api',
                skillName: 'Fetch API & AJAX Integration',
                prerequisites: ['js_promises_async'],
                difficulty: 'INTERMEDIATE',
                estimatedHours: 5,
                subskills: [
                  { subskillId: 'fetch_get_post_req', skillName: 'HTTP GET/POST Requests via Fetch API', prerequisites: [], difficulty: 'INTERMEDIATE', estimatedMinutes: 45 },
                  { subskillId: 'fetch_json_parsing', skillName: 'Parsing JSON Payloads & Network Headers', prerequisites: ['fetch_get_post_req'], difficulty: 'INTERMEDIATE', estimatedMinutes: 45 }
                ]
              }
            ]
          }
        ]
      },
      {
        id: 'fs_top_react',
        name: 'React UI Architecture',
        subtopics: [
          {
            id: 'fs_sub_react_basics',
            name: 'React Components & Props',
            skills: [
              {
                skillId: 'react_jsx_comps',
                skillName: 'React JSX & Component Hierarchy',
                prerequisites: ['js_fetch_api'],
                difficulty: 'INTERMEDIATE',
                estimatedHours: 6,
                subskills: [
                  { subskillId: 'react_jsx_syntax', skillName: 'JSX Syntax & Embedding Expressions', prerequisites: [], difficulty: 'INTERMEDIATE', estimatedMinutes: 45 },
                  { subskillId: 'react_functional_comps', skillName: 'Functional Components & Modular UI', prerequisites: ['react_jsx_syntax'], difficulty: 'INTERMEDIATE', estimatedMinutes: 45 }
                ]
              },
              {
                skillId: 'react_props_state',
                skillName: 'React State & Props Management',
                prerequisites: ['react_jsx_comps'],
                difficulty: 'INTERMEDIATE',
                estimatedHours: 6,
                subskills: [
                  { subskillId: 'react_props_passing', skillName: 'Passing Props & Component Interactivity', prerequisites: [], difficulty: 'INTERMEDIATE', estimatedMinutes: 45 },
                  { subskillId: 'react_usestate_hook', skillName: 'useState Hook & State Updates', prerequisites: ['react_props_passing'], difficulty: 'INTERMEDIATE', estimatedMinutes: 45 }
                ]
              }
            ]
          },
          {
            id: 'fs_sub_react_hooks',
            name: 'React Hooks & State',
            skills: [
              {
                skillId: 'react_hooks_core',
                skillName: 'React Hooks (useState & useEffect)',
                prerequisites: ['react_props_state'],
                difficulty: 'INTERMEDIATE',
                estimatedHours: 6,
                subskills: [
                  { subskillId: 'react_useeffect_fetch', skillName: 'useEffect Hook & Data Fetching', prerequisites: [], difficulty: 'INTERMEDIATE', estimatedMinutes: 45 },
                  { subskillId: 'react_form_inputs', skillName: 'Controlled Forms & Event Handling', prerequisites: ['react_useeffect_fetch'], difficulty: 'INTERMEDIATE', estimatedMinutes: 45 }
                ]
              },
              {
                skillId: 'react_router_arch',
                skillName: 'React Router & SPA Architecture',
                prerequisites: ['react_hooks_core'],
                difficulty: 'INTERMEDIATE',
                estimatedHours: 6,
                subskills: [
                  { subskillId: 'react_client_routing', skillName: 'React Router Client-Side Navigation', prerequisites: [], difficulty: 'INTERMEDIATE', estimatedMinutes: 45 },
                  { subskillId: 'react_global_context', skillName: 'Context API & Global State', prerequisites: ['react_client_routing'], difficulty: 'INTERMEDIATE', estimatedMinutes: 45 }
                ]
              }
            ]
          }
        ]
      },
      {
        id: 'fs_top_backend',
        name: 'Backend API & Databases',
        subtopics: [
          {
            id: 'fs_sub_express',
            name: 'Node.js & Express',
            skills: [
              {
                skillId: 'node_event_loop',
                skillName: 'Node.js Basics & Event Loop',
                prerequisites: ['js_promises_async'],
                difficulty: 'INTERMEDIATE',
                estimatedHours: 6,
                subskills: [
                  { subskillId: 'node_modules_fs', skillName: 'Node.js Core Modules & File System', prerequisites: [], difficulty: 'INTERMEDIATE', estimatedMinutes: 45 },
                  { subskillId: 'node_http_server', skillName: 'HTTP Module & Server Setup', prerequisites: ['node_modules_fs'], difficulty: 'INTERMEDIATE', estimatedMinutes: 45 }
                ]
              },
              {
                skillId: 'express_rest_apis',
                skillName: 'Express Middleware & REST APIs',
                prerequisites: ['node_event_loop'],
                difficulty: 'INTERMEDIATE',
                estimatedHours: 6,
                subskills: [
                  { subskillId: 'express_routing', skillName: 'Express Routing & URL Parameters', prerequisites: [], difficulty: 'INTERMEDIATE', estimatedMinutes: 45 },
                  { subskillId: 'express_middleware', skillName: 'Middleware Pipelines & Error Handling', prerequisites: ['express_routing'], difficulty: 'INTERMEDIATE', estimatedMinutes: 45 }
                ]
              }
            ]
          },
          {
            id: 'fs_sub_db',
            name: 'Databases (SQL & NoSQL)',
            skills: [
              {
                skillId: 'db_sql_relational',
                skillName: 'SQL Database Design & Queries',
                prerequisites: ['express_rest_apis'],
                difficulty: 'INTERMEDIATE',
                estimatedHours: 7,
                subskills: [
                  { subskillId: 'sql_schema_design', skillName: 'Relational Schema & Primary/Foreign Keys', prerequisites: [], difficulty: 'INTERMEDIATE', estimatedMinutes: 45 },
                  { subskillId: 'sql_queries_joins', skillName: 'SELECT Queries, JOINS & Indexing', prerequisites: ['sql_schema_design'], difficulty: 'INTERMEDIATE', estimatedMinutes: 45 }
                ]
              },
              {
                skillId: 'db_mongo_nosql',
                skillName: 'MongoDB Document Schemas & Mongoose',
                prerequisites: ['express_rest_apis'],
                difficulty: 'INTERMEDIATE',
                estimatedHours: 7,
                subskills: [
                  { subskillId: 'mongo_document_crud', skillName: 'MongoDB Documents & CRUD Operations', prerequisites: [], difficulty: 'INTERMEDIATE', estimatedMinutes: 45 },
                  { subskillId: 'mongoose_odm_models', skillName: 'Mongoose Schemas & ODM Validation', prerequisites: ['mongo_document_crud'], difficulty: 'INTERMEDIATE', estimatedMinutes: 45 }
                ]
              }
            ]
          }
        ]
      },
      {
        id: 'fs_top_advanced',
        name: 'Web Security & System Architecture',
        subtopics: [
          {
            id: 'fs_sub_sec',
            name: 'Web Security',
            skills: [
              {
                skillId: 'web_auth_jwt',
                skillName: 'Authentication & JWT Session Security',
                prerequisites: ['db_sql_relational', 'db_mongo_nosql'],
                difficulty: 'ADVANCED',
                estimatedHours: 6,
                subskills: [
                  { subskillId: 'auth_password_hashing', skillName: 'Password Hashing (bcrypt/Argon2)', prerequisites: [], difficulty: 'ADVANCED', estimatedMinutes: 45 },
                  { subskillId: 'auth_jwt_tokens', skillName: 'JWT Signing, Verification & Cookies', prerequisites: ['auth_password_hashing'], difficulty: 'ADVANCED', estimatedMinutes: 45 }
                ]
              },
              {
                skillId: 'web_owasp_sec',
                skillName: 'XSS, CSRF, SQLi & CORS Security',
                prerequisites: ['web_auth_jwt'],
                difficulty: 'ADVANCED',
                estimatedHours: 6,
                subskills: [
                  { subskillId: 'sec_xss_prevention', skillName: 'XSS Output Encoding & Sanitization', prerequisites: [], difficulty: 'ADVANCED', estimatedMinutes: 45 },
                  { subskillId: 'sec_sqli_cors', skillName: 'SQLi Parameterization & CORS Headers', prerequisites: ['sec_xss_prevention'], difficulty: 'ADVANCED', estimatedMinutes: 45 }
                ]
              }
            ]
          },
          {
            id: 'fs_top_devops',
            name: 'Full-Stack Deployment',
            skills: [
              {
                skillId: 'docker_containers',
                skillName: 'Docker Containerization for Web Apps',
                prerequisites: ['web_owasp_sec'],
                difficulty: 'ADVANCED',
                estimatedHours: 8,
                subskills: [
                  { subskillId: 'dockerfile_builds', skillName: 'Dockerfile Syntax & Multi-Stage Builds', prerequisites: [], difficulty: 'ADVANCED', estimatedMinutes: 45 },
                  { subskillId: 'docker_compose_setup', skillName: 'Docker Compose Orchestration', prerequisites: ['dockerfile_builds'], difficulty: 'ADVANCED', estimatedMinutes: 45 }
                ]
              },
              {
                skillId: 'fullstack_deployment',
                skillName: 'CI/CD Pipelines & Cloud Deployment',
                prerequisites: ['docker_containers'],
                difficulty: 'ADVANCED',
                estimatedHours: 8,
                subskills: [
                  { subskillId: 'cicd_github_actions', skillName: 'GitHub Actions CI/CD Pipeline', prerequisites: [], difficulty: 'ADVANCED', estimatedMinutes: 45 },
                  { subskillId: 'cloud_hosting_prod', skillName: 'Cloud Server Deployment & SSL Setup', prerequisites: ['cicd_github_actions'], difficulty: 'ADVANCED', estimatedMinutes: 45 }
                ]
              }
            ]
          }
        ]
      }
    ]
  },

  datascience: {
    domainId: 'datascience',
    domainName: 'Data Science & Machine Learning',
    topics: [
      {
        id: 'ds_top_py_fund',
        name: 'Python Fundamentals',
        subtopics: [
          {
            id: 'ds_sub_vars',
            name: 'Python Syntax',
            skills: [
              {
                skillId: 'py_vars_primitives',
                skillName: 'Python Syntax & Primitive Data Types',
                prerequisites: [],
                difficulty: 'BEGINNER',
                estimatedHours: 3,
                subskills: [
                  { subskillId: 'py_vars_assign', skillName: 'Variables & Memory Assignment', prerequisites: [], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: 'py_data_types', skillName: 'Strings, Integers, Floats & Booleans', prerequisites: ['py_vars_assign'], difficulty: 'BEGINNER', estimatedMinutes: 45 }
                ]
              },
              {
                skillId: 'py_control_loops',
                skillName: 'Control Flow (if/else, loops)',
                prerequisites: ['py_vars_primitives'],
                difficulty: 'BEGINNER',
                estimatedHours: 4,
                subskills: [
                  { subskillId: 'py_if_conditionals', skillName: 'If, Elif & Else Conditions', prerequisites: [], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: 'py_for_while_iter', skillName: 'For & While Loops Iteration', prerequisites: ['py_if_conditionals'], difficulty: 'BEGINNER', estimatedMinutes: 45 }
                ]
              }
            ]
          },
          {
            id: 'ds_sub_funcs',
            name: 'Functions & Data Structures',
            skills: [
              {
                skillId: 'py_funcs_modules',
                skillName: 'Python Functions & Scope',
                prerequisites: ['py_control_loops'],
                difficulty: 'BEGINNER',
                estimatedHours: 4,
                subskills: [
                  { subskillId: 'py_func_params_return', skillName: 'Function Arguments & Return Values', prerequisites: [], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: 'py_lambda_scope', skillName: 'Lambda Functions & Local/Global Scope', prerequisites: ['py_func_params_return'], difficulty: 'BEGINNER', estimatedMinutes: 45 }
                ]
              },
              {
                skillId: 'py_structs_lists',
                skillName: 'Python Data Structures (Lists, Dicts, Sets)',
                prerequisites: ['py_funcs_modules'],
                difficulty: 'BEGINNER',
                estimatedHours: 4,
                subskills: [
                  { subskillId: 'py_lists_tuples', skillName: 'List Manipulation & Tuples', prerequisites: [], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: 'py_dicts_sets', skillName: 'Dictionaries & Set Operations', prerequisites: ['py_lists_tuples'], difficulty: 'BEGINNER', estimatedMinutes: 45 }
                ]
              }
            ]
          }
        ]
      },
      {
        id: 'ds_top_data_proc',
        name: 'Data Processing & EDA',
        subtopics: [
          {
            id: 'ds_sub_numpy',
            name: 'NumPy Vectorization',
            skills: [
              {
                skillId: 'np_vectorized_ops',
                skillName: 'NumPy Arrays & Linear Math',
                prerequisites: ['py_structs_lists'],
                difficulty: 'BEGINNER',
                estimatedHours: 5,
                subskills: [
                  { subskillId: 'np_array_creation', skillName: 'NumPy Array Creation & Reshaping', prerequisites: [], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: 'np_indexing_slicing', skillName: 'NumPy Indexing, Slicing & Broadcasting', prerequisites: ['np_array_creation'], difficulty: 'BEGINNER', estimatedMinutes: 45 }
                ]
              }
            ]
          },
          {
            id: 'ds_sub_pandas',
            name: 'Pandas DataFrames',
            skills: [
              {
                skillId: 'pd_df_manipulation',
                skillName: 'Pandas DataFrames & Manipulation',
                prerequisites: ['np_vectorized_ops'],
                difficulty: 'INTERMEDIATE',
                estimatedHours: 6,
                subskills: [
                  { subskillId: 'pd_dataframe_basics', skillName: 'DataFrame Loading, Columns & Indexing', prerequisites: [], difficulty: 'INTERMEDIATE', estimatedMinutes: 45 },
                  { subskillId: 'pd_filtering_groupby', skillName: 'Data Filtering, GroupBy & Aggregations', prerequisites: ['pd_dataframe_basics'], difficulty: 'INTERMEDIATE', estimatedMinutes: 45 }
                ]
              },
              {
                skillId: 'pd_cleaning_eda',
                skillName: 'Data Cleaning, Filtering & EDA',
                prerequisites: ['pd_df_manipulation'],
                difficulty: 'INTERMEDIATE',
                estimatedHours: 6,
                subskills: [
                  { subskillId: 'pd_missing_values', skillName: 'Handling Missing Data & Imputation', prerequisites: [], difficulty: 'INTERMEDIATE', estimatedMinutes: 45 },
                  { subskillId: 'eda_matplotlib_seaborn', skillName: 'EDA Visualizations with Matplotlib & Seaborn', prerequisites: ['pd_missing_values'], difficulty: 'INTERMEDIATE', estimatedMinutes: 45 }
                ]
              }
            ]
          }
        ]
      },
      {
        id: 'ds_top_stats',
        name: 'Statistics & Probability',
        subtopics: [
          {
            id: 'ds_sub_stats',
            name: 'Inferential Statistics',
            skills: [
              {
                skillId: 'stat_desc_inf',
                skillName: 'Descriptive & Inferential Statistics',
                prerequisites: ['pd_cleaning_eda'],
                difficulty: 'INTERMEDIATE',
                estimatedHours: 5,
                subskills: [
                  { subskillId: 'stat_mean_std_dist', skillName: 'Mean, Variance, Std Dev & Distributions', prerequisites: [], difficulty: 'INTERMEDIATE', estimatedMinutes: 45 },
                  { subskillId: 'stat_prob_bayes', skillName: 'Probability Theory & Bayes Theorem', prerequisites: ['stat_mean_std_dist'], difficulty: 'INTERMEDIATE', estimatedMinutes: 45 }
                ]
              },
              {
                skillId: 'stat_hyp_testing',
                skillName: 'Hypothesis Testing & p-values',
                prerequisites: ['stat_desc_inf'],
                difficulty: 'INTERMEDIATE',
                estimatedHours: 5,
                subskills: [
                  { subskillId: 'stat_null_alt_hyp', skillName: 'Null/Alternative Hypothesis & Significance', prerequisites: [], difficulty: 'INTERMEDIATE', estimatedMinutes: 45 },
                  { subskillId: 'stat_ttest_anova', skillName: 't-Tests, ANOVA & Chi-Square Tests', prerequisites: ['stat_null_alt_hyp'], difficulty: 'INTERMEDIATE', estimatedMinutes: 45 }
                ]
              }
            ]
          }
        ]
      },
      {
        id: 'ds_top_ml',
        name: 'Machine Learning Fundamentals',
        subtopics: [
          {
            id: 'ds_sub_supervised',
            name: 'Supervised Learning',
            skills: [
              {
                skillId: 'ml_lin_log_reg',
                skillName: 'Linear & Logistic Regression',
                prerequisites: ['stat_hyp_testing'],
                difficulty: 'INTERMEDIATE',
                estimatedHours: 6,
                subskills: [
                  { subskillId: 'ml_linear_reg_math', skillName: 'Linear Regression Math & Cost Function', prerequisites: [], difficulty: 'INTERMEDIATE', estimatedMinutes: 45 },
                  { subskillId: 'ml_logistic_reg_cls', skillName: 'Logistic Regression Classification', prerequisites: ['ml_linear_reg_math'], difficulty: 'INTERMEDIATE', estimatedMinutes: 45 }
                ]
              },
              {
                skillId: 'ml_trees_forests',
                skillName: 'Decision Trees & Random Forests',
                prerequisites: ['ml_lin_log_reg'],
                difficulty: 'INTERMEDIATE',
                estimatedHours: 6,
                subskills: [
                  { subskillId: 'ml_decision_tree_split', skillName: 'Decision Tree Splitting (Gini / Entropy)', prerequisites: [], difficulty: 'INTERMEDIATE', estimatedMinutes: 45 },
                  { subskillId: 'ml_random_forest_bag', skillName: 'Random Forests & Bagging Ensembles', prerequisites: ['ml_decision_tree_split'], difficulty: 'INTERMEDIATE', estimatedMinutes: 45 }
                ]
              }
            ]
          },
          {
            id: 'ds_sub_ensembles',
            name: 'Ensembles & Tuning',
            skills: [
              {
                skillId: 'ml_grad_boosting',
                skillName: 'Gradient Boosting (XGBoost/LightGBM)',
                prerequisites: ['ml_trees_forests'],
                difficulty: 'ADVANCED',
                estimatedHours: 8,
                subskills: [
                  { subskillId: 'ml_xgboost_algo', skillName: 'XGBoost Boosting Architecture', prerequisites: [], difficulty: 'ADVANCED', estimatedMinutes: 45 },
                  { subskillId: 'ml_lightgbm_catboost', skillName: 'LightGBM & CatBoost Performance', prerequisites: ['ml_xgboost_algo'], difficulty: 'ADVANCED', estimatedMinutes: 45 }
                ]
              },
              {
                skillId: 'ml_hyper_tuning',
                skillName: 'Hyperparameter Tuning & Cross-Validation',
                prerequisites: ['ml_grad_boosting'],
                difficulty: 'ADVANCED',
                estimatedHours: 6,
                subskills: [
                  { subskillId: 'ml_grid_random_search', skillName: 'GridSearch & RandomSearch Optimization', prerequisites: [], difficulty: 'ADVANCED', estimatedMinutes: 45 },
                  { subskillId: 'ml_kfold_cv', skillName: 'Stratified K-Fold Cross-Validation', prerequisites: ['ml_grid_random_search'], difficulty: 'ADVANCED', estimatedMinutes: 45 }
                ]
              }
            ]
          }
        ]
      },
      {
        id: 'ds_top_dl',
        name: 'Deep Learning & NLP',
        subtopics: [
          {
            id: 'ds_sub_nn',
            name: 'Neural Networks',
            skills: [
              {
                skillId: 'dl_ann_backprop',
                skillName: 'Neural Networks & Backpropagation',
                prerequisites: ['ml_hyper_tuning'],
                difficulty: 'ADVANCED',
                estimatedHours: 10,
                subskills: [
                  { subskillId: 'dl_perceptron_dense', skillName: 'Dense Layers & Activation Functions', prerequisites: [], difficulty: 'ADVANCED', estimatedMinutes: 45 },
                  { subskillId: 'dl_backprop_grad', skillName: 'Backpropagation & Gradient Descent', prerequisites: ['dl_perceptron_dense'], difficulty: 'ADVANCED', estimatedMinutes: 45 }
                ]
              },
              {
                skillId: 'dl_cnn_vision',
                skillName: 'CNNs for Computer Vision',
                prerequisites: ['dl_ann_backprop'],
                difficulty: 'ADVANCED',
                estimatedHours: 8,
                subskills: [
                  { subskillId: 'dl_conv_pooling', skillName: 'Convolutional & Pooling Layers', prerequisites: [], difficulty: 'ADVANCED', estimatedMinutes: 45 },
                  { subskillId: 'dl_image_cls', skillName: 'Image Classification Architectures', prerequisites: ['dl_conv_pooling'], difficulty: 'ADVANCED', estimatedMinutes: 45 }
                ]
              }
            ]
          },
          {
            id: 'ds_sub_nlp',
            name: 'Natural Language Processing',
            skills: [
              {
                skillId: 'nlp_transformers_llm',
                skillName: 'Transformers & LLM Fine-Tuning',
                prerequisites: ['dl_cnn_vision'],
                difficulty: 'ADVANCED',
                estimatedHours: 12,
                subskills: [
                  { subskillId: 'nlp_word_embeddings', skillName: 'Word Embeddings & Self-Attention', prerequisites: [], difficulty: 'ADVANCED', estimatedMinutes: 45 },
                  { subskillId: 'nlp_transformer_bert_gpt', skillName: 'Transformer Encoder/Decoder Models', prerequisites: ['nlp_word_embeddings'], difficulty: 'ADVANCED', estimatedMinutes: 45 }
                ]
              },
              {
                skillId: 'mlops_fastapi_deploy',
                skillName: 'MLOps, Model Serving & FastAPI Deployment',
                prerequisites: ['nlp_transformers_llm'],
                difficulty: 'ADVANCED',
                estimatedHours: 10,
                subskills: [
                  { subskillId: 'mlops_model_pickle', skillName: 'Model Serialization (Pickle/ONNX)', prerequisites: [], difficulty: 'ADVANCED', estimatedMinutes: 45 },
                  { subskillId: 'mlops_fastapi_serving', skillName: 'FastAPI Serving & Endpoint Monitoring', prerequisites: ['mlops_model_pickle'], difficulty: 'ADVANCED', estimatedMinutes: 45 }
                ]
              }
            ]
          }
        ]
      }
    ]
  },

  cybersecurity: {
    domainId: 'cybersecurity',
    domainName: 'Cybersecurity & Ethical Hacking',
    topics: [
      {
        id: 'sec_top_cli_net',
        name: 'CLI & Networking Basics',
        subtopics: [
          {
            id: 'sec_sub_sys',
            name: 'Linux CLI & OS',
            skills: [
              {
                skillId: 'sec_linux_cli',
                skillName: 'Linux Command Line & Systems Basics',
                prerequisites: [],
                difficulty: 'BEGINNER',
                estimatedHours: 4,
                subskills: [
                  { subskillId: 'sec_cli_nav', skillName: 'Linux Directory Navigation & Permissions', prerequisites: [], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: 'sec_sys_users', skillName: 'User Management & Process Control', prerequisites: ['sec_cli_nav'], difficulty: 'BEGINNER', estimatedMinutes: 45 }
                ]
              },
              {
                skillId: 'sec_net_tcpip',
                skillName: 'Computer Networking & TCP/IP Protocols',
                prerequisites: ['sec_linux_cli'],
                difficulty: 'BEGINNER',
                estimatedHours: 5,
                subskills: [
                  { subskillId: 'sec_ip_subnets', skillName: 'IP Addressing & Subnet Masking', prerequisites: [], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: 'sec_tcp_handshake', skillName: 'TCP/IP 3-Way Handshake & Ports', prerequisites: ['sec_ip_subnets'], difficulty: 'BEGINNER', estimatedMinutes: 45 }
                ]
              }
            ]
          }
        ]
      }
    ]
  },

  devops: {
    domainId: 'devops',
    domainName: 'Cloud Engineering & DevOps',
    topics: [
      {
        id: 'dev_top_sys_linux',
        name: 'Linux Administration & Shell',
        subtopics: [
          {
            id: 'dev_sub_linux',
            name: 'Linux System Admin',
            skills: [
              {
                skillId: 'dev_linux_sys_admin',
                skillName: 'Linux Administration & Command Line',
                prerequisites: [],
                difficulty: 'BEGINNER',
                estimatedHours: 4,
                subskills: [
                  { subskillId: 'dev_linux_files', skillName: 'Linux File System & Permissions', prerequisites: [], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: 'dev_systemd_services', skillName: 'Systemd Service Configuration', prerequisites: ['dev_linux_files'], difficulty: 'BEGINNER', estimatedMinutes: 45 }
                ]
              }
            ]
          }
        ]
      }
    ]
  },

  dsa: {
    domainId: 'dsa',
    domainName: 'Data Structures & Algorithms (Interview Prep)',
    topics: [
      {
        id: 'dsa_top_complexity',
        name: 'Complexity & Basic Arrays',
        subtopics: [
          {
            id: 'dsa_sub_complexity',
            name: 'Big-O Analysis',
            skills: [
              {
                skillId: 'dsa_big_o_analysis',
                skillName: 'Big-O Time & Space Complexity',
                prerequisites: [],
                difficulty: 'BEGINNER',
                estimatedHours: 3,
                subskills: [
                  { subskillId: 'dsa_time_complexity', skillName: 'Big-O Time Complexity Analysis', prerequisites: [], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: 'dsa_space_complexity', skillName: 'Space Complexity & Auxiliary Memory', prerequisites: ['dsa_time_complexity'], difficulty: 'BEGINNER', estimatedMinutes: 45 }
                ]
              }
            ]
          }
        ]
      }
    ]
  },

  mobile: {
    domainId: 'mobile',
    domainName: 'Mobile App Development (React Native & Flutter)',
    topics: [
      {
        id: 'mob_top_found',
        name: 'Mobile Programming & UI Basics',
        subtopics: [
          {
            id: 'mob_sub_basics',
            name: 'JS/Dart Syntax',
            skills: [
              {
                skillId: 'mob_lang_syntax',
                skillName: 'JavaScript/Dart Mobile Syntax',
                prerequisites: [],
                difficulty: 'BEGINNER',
                estimatedHours: 4,
                subskills: [
                  { subskillId: 'mob_syntax_vars', skillName: 'Mobile Language Syntax & Primitives', prerequisites: [], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: 'mob_flexbox_ui', skillName: 'Mobile Screen Layouts & Flexbox', prerequisites: ['mob_syntax_vars'], difficulty: 'BEGINNER', estimatedMinutes: 45 }
                ]
              }
            ]
          }
        ]
      }
    ]
  },

  ai_llm: {
    domainId: 'ai_llm',
    domainName: 'AI & LLM Systems Engineering',
    topics: [
      {
        id: 'ai_top_prompts_vec',
        name: 'Prompt Engineering & Vectors',
        subtopics: [
          {
            id: 'ai_sub_prompts',
            name: 'Prompt Engineering',
            skills: [
              {
                skillId: 'ai_prompt_design',
                skillName: 'System Prompts & Structured Outputs',
                prerequisites: [],
                difficulty: 'BEGINNER',
                estimatedHours: 4,
                subskills: [
                  { subskillId: 'ai_sys_prompts', skillName: 'System Role Design & Constraints', prerequisites: [], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: 'ai_json_output', skillName: 'Structured JSON Generation Schema', prerequisites: ['ai_sys_prompts'], difficulty: 'BEGINNER', estimatedMinutes: 45 }
                ]
              }
            ]
          }
        ]
      }
    ]
  },

  system_design: {
    domainId: 'system_design',
    domainName: 'System Design & Distributed Architecture',
    topics: [
      {
        id: 'sd_top_scaling_cache',
        name: 'Scalability & Caching',
        subtopics: [
          {
            id: 'sd_sub_scale',
            name: 'Load Balancing',
            skills: [
              {
                skillId: 'sd_http_client_server',
                skillName: 'Client-Server Principles & HTTP/HTTPS',
                prerequisites: [],
                difficulty: 'BEGINNER',
                estimatedHours: 4,
                subskills: [
                  { subskillId: 'sd_client_req', skillName: 'HTTP Request/Response Anatomy', prerequisites: [], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: 'sd_dns_routing', skillName: 'DNS Resolution & Routing', prerequisites: ['sd_client_req'], difficulty: 'BEGINNER', estimatedMinutes: 45 }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
};

/**
 * Normalizes domain key
 */
function normalizeDomainKey(rawDomain) {
  if (!rawDomain || typeof rawDomain !== 'string') return 'fullstack';
  const clean = rawDomain.trim().toLowerCase();
  if (clean.includes('datascience') || clean.includes('data science') || clean.includes('machine learning')) return 'datascience';
  if (clean.includes('dsa') || clean.includes('algorithm') || clean.includes('data structure') || clean.includes('interview prep')) return 'dsa';
  if (clean.includes('devops') || clean.includes('cloud')) return 'devops';
  if (clean.includes('cyber') || clean.includes('security') || clean.includes('hacking')) return 'cybersecurity';
  if (clean.includes('mobile') || clean.includes('react native') || clean.includes('flutter') || clean.includes('ios') || clean.includes('android')) return 'mobile';
  if (clean.includes('ai') || clean.includes('llm') || clean.includes('genai') || clean.includes('rag')) return 'ai_llm';
  if (clean.includes('system design') || clean.includes('system_design') || clean.includes('architecture') || clean.includes('microservice')) return 'system_design';
  return 'fullstack';
}

/**
 * Returns Knowledge Graph for given domain (with dynamic fallback generator for arbitrary domains)
 */
function getKnowledgeGraph(rawDomain) {
  const domainKey = normalizeDomainKey(rawDomain);
  if (DOMAIN_KNOWLEDGE_GRAPHS[domainKey]) {
    return DOMAIN_KNOWLEDGE_GRAPHS[domainKey];
  }

  // Dynamic Graph Generator fallback for arbitrary domains
  const sanitizedDomain = (rawDomain || 'Technology').trim();
  return {
    domainId: domainKey,
    domainName: sanitizedDomain,
    topics: [
      {
        id: `${domainKey}_topic_fund`,
        name: `${sanitizedDomain} Fundamentals`,
        subtopics: [
          {
            id: `${domainKey}_sub_basics`,
            name: 'Core Concepts & Tooling',
            skills: [
              {
                skillId: `${domainKey}_basics`,
                skillName: `${sanitizedDomain} Core Principles`,
                prerequisites: [],
                difficulty: 'BEGINNER',
                estimatedHours: 4,
                subskills: [
                  { subskillId: `${domainKey}_sub_concept1`, subskillName: `${sanitizedDomain} Foundation Overview`, prerequisites: [], difficulty: 'BEGINNER', estimatedMinutes: 45 },
                  { subskillId: `${domainKey}_sub_concept2`, subskillName: `${sanitizedDomain} Applied Syntax`, prerequisites: [`${domainKey}_sub_concept1`], difficulty: 'BEGINNER', estimatedMinutes: 45 }
                ]
              }
            ]
          }
        ]
      }
    ]
  };
}

/**
 * Flatten all skills in a Knowledge Graph into an array
 */
function getAllSkillsInGraph(graph) {
  const skills = [];
  if (!graph || !Array.isArray(graph.topics)) return skills;

  graph.topics.forEach(t => {
    if (Array.isArray(t.subtopics)) {
      t.subtopics.forEach(s => {
        if (Array.isArray(s.skills)) {
          s.skills.forEach(sk => {
            skills.push({
              ...sk,
              topicId: t.id,
              topicName: t.name,
              subtopicId: s.id,
              subtopicName: s.name,
              domain: graph.domainName
            });
          });
        }
      });
    }
  });

  return skills;
}

/**
 * Topologically sort skills based on prerequisites (DAG sort)
 */
function topologicalSortSkills(skills) {
  const skillMap = new Map();
  skills.forEach(s => skillMap.set(s.skillId, s));

  const visited = new Set();
  const sorted = [];
  const tempMark = new Set();

  function visit(skillId) {
    if (tempMark.has(skillId)) return; // Avoid circular deadlock
    if (!visited.has(skillId)) {
      tempMark.add(skillId);
      const sk = skillMap.get(skillId);
      if (sk && Array.isArray(sk.prerequisites)) {
        sk.prerequisites.forEach(prereqId => {
          if (skillMap.has(prereqId)) {
            visit(prereqId);
          }
        });
      }
      tempMark.delete(skillId);
      visited.add(skillId);
      if (sk) sorted.push(sk);
    }
  }

  skills.forEach(s => {
    if (!visited.has(s.skillId)) {
      visit(s.skillId);
    }
  });

  return sorted;
}

/**
 * Returns ordered subskills for a skill node
 */
function getOrderedSubskillsForSkill(skillNode) {
  if (!skillNode || !Array.isArray(skillNode.subskills) || skillNode.subskills.length === 0) {
    const baseName = skillNode ? (skillNode.skillName || skillNode.subtopicName || 'Core Concept') : 'Core Concept';
    return [
      { subskillId: `${skillNode ? skillNode.skillId : 'sk'}_sub1`, subskillName: `${baseName}: Structure & Syntax`, prerequisites: [], difficulty: skillNode ? skillNode.difficulty : 'BEGINNER', estimatedMinutes: 45 },
      { subskillId: `${skillNode ? skillNode.skillId : 'sk'}_sub2`, subskillName: `${baseName}: Application & Rules`, prerequisites: [`${skillNode ? skillNode.skillId : 'sk'}_sub1`], difficulty: skillNode ? skillNode.difficulty : 'BEGINNER', estimatedMinutes: 45 },
      { subskillId: `${skillNode ? skillNode.skillId : 'sk'}_sub3`, subskillName: `${baseName}: Code Drills`, prerequisites: [`${skillNode ? skillNode.skillId : 'sk'}_sub2`], difficulty: skillNode ? skillNode.difficulty : 'BEGINNER', estimatedMinutes: 45 },
      { subskillId: `${skillNode ? skillNode.skillId : 'sk'}_sub4`, subskillName: `${baseName}: Practical Project`, prerequisites: [`${skillNode ? skillNode.skillId : 'sk'}_sub3`], difficulty: skillNode ? skillNode.difficulty : 'INTERMEDIATE', estimatedMinutes: 45 },
      { subskillId: `${skillNode ? skillNode.skillId : 'sk'}_sub5`, subskillName: `${baseName}: Assessment & Review`, prerequisites: [`${skillNode ? skillNode.skillId : 'sk'}_sub4`], difficulty: skillNode ? skillNode.difficulty : 'INTERMEDIATE', estimatedMinutes: 45 }
    ];
  }

  return skillNode.subskills.map(sub => ({
    ...sub,
    subskillId: sub.subskillId || sub.skillId,
    subskillName: sub.subskillName || sub.skillName || 'Subskill Concept'
  }));
}

module.exports = {
  DOMAIN_KNOWLEDGE_GRAPHS,
  normalizeDomainKey,
  getKnowledgeGraph,
  getAllSkillsInGraph,
  topologicalSortSkills,
  getOrderedSubskillsForSkill
};
