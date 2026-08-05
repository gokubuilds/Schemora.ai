# Schema-Aware Test Data Generator
An intelligent, schema-aware test data generation tool that utilizes Large Language Models (LLMs) to create realistic, referentially consistent synthetic data based on SQL DDL definitions.


## Key Features

- **Schema Introspection & Parsing:** Automatically parses standard SQL DDL (Data Definition Language) to understand table structures, data types, and constraints.
- **Natural Language Schema Generation:** Provide a plain English description of your database (e.g., "An e-commerce app with users and orders") and the tool will automatically generate the corresponding SQL DDL for you.
- **Topological Sorting:** Resolves foreign key dependencies to ensure tables are populated in the correct relational order (e.g., creating `users` before `posts`).
- **LLM-Powered Data Mapping:** Uses Groq client (Llama 3.1 70b) to intelligently map database columns to appropriate semantic data generators (via Faker), ensuring contextually accurate test data (e.g., mapping `email_addr` to real-looking email addresses).
- **Multiple Export Formats:** Generates both combined `seed_all.sql` files and individual table `.csv` data dumps.

## Architecture

```mermaid
flowchart TD
    %% Colors and Styles
    classDef client fill:#e1f5fe,stroke:#0288d1,stroke-width:2px,color:#01579b;
    classDef core fill:#efebe9,stroke:#5d4037,stroke-width:2px,color:#3e2723;
    classDef service fill:#ede7f6,stroke:#5e35b1,stroke-width:2px,color:#4a148c;
    classDef storage fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#1b5e20;

    subgraph Client ["Client Interfaces"]
        UI["💻 Web UI (HTML/CSS/JS)"]:::client
        CLI["📟 CLI Tool (main.py)"]:::client
    end

    subgraph App ["Schemora.ai Core Engine"]
        Parser["📝 SQL DDL Parser"]:::core
        Sorter["🔄 Topological Sorter (Dependency Resolver)"]:::core
        Mapper["🧠 LLM Data Mapper (Column Semantic Mapping)"]:::core
        Generator["⚡ Synthetic Data Generator (Faker)"]:::core
        Exporter["💾 Data Exporter"]:::core
    end

    subgraph External ["External Services & Cache"]
        Groq["🤖 Groq API (Llama 3.1 70B)"]:::service
        Cache["📁 Cache (mapper_cache.json)"]:::storage
    end

    subgraph Output ["Target Outputs"]
        SQL["📄 seed_all.sql"]:::storage
        CSV["📊 CSV Dumps"]:::storage
    end

    %% User / CLI Input Flow
    UI -->|1. Submit SQL DDL or Natural Language| Parser
    CLI -->|1. Provide SQL DDL File| Parser
    UI <-->|Translate NLP to SQL DDL| Groq

    %% Core Pipeline Flow
    Parser -->|2. Abstract Syntax Tree & Constraints| Sorter
    Sorter -->|3. Sorted Table Evaluation Order| Mapper
    Mapper <-->|4. Fetch/Save Mappings| Cache
    Mapper <-->|4. Query Column Semantics| Groq
    Mapper -->|5. Match Columns to Faker Providers| Generator
    Generator -->|6. Generate Synthesized Row Data| Exporter
    Exporter -->|7. Export Formatted SQL Seeds| SQL
    Exporter -->|7. Export Formatted CSVs| CSV
```

- **Backend:** Python 3, FastAPI, Click (for CLI)
- **Frontend:** Vanilla HTML5, CSS3, JavaScript
- **AI Integration:** Groq API ( Llama 3.1 70b ) for Schema Generation and Data Mapping
- **Data Generation:** Python Faker

## Prerequisites

- Python 3.9 or higher
- A valid Groq API Key

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/gokubuilds/Schemora.ai.git
   cd Schemora.ai
   ```

2. **Set up a virtual environment:**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate  # On Windows use: .venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure Environment Variables:**
   Create a `.env` file in the root directory and add your Anthropic API key:
   ```env
   GROQ_API_KEY=your_api_key_here
   ```

## Usage

### Running the Web Application

To launch the web interface, run the FastAPI server:

```bash
uvicorn backend.app:app --reload
```

Then, open your browser and navigate to `http://localhost:8000`. 

You can provide your schema in two ways:
1. **DDL Input:** Paste your existing SQL DDL into the text area.
2. **NLP Input:** Switch to the NLP tab, describe your schema in plain text, and click **Generate DDL** to have the LLM write the SQL for you.

Specify the number of rows, and click "Generate Data".

### Running the Command Line Interface (CLI)

You can generate data directly from the terminal without launching the web server.

```bash
python -m backend.main --ddl schemas/sample.sql --rows 50 --output ./output
```

**CLI Arguments:**
- `--ddl` (Required): Path to your SQL DDL file containing `CREATE TABLE` statements.
- `--rows` (Optional): Number of rows to generate per table. Default is 20 (Maximum 10,000 for safety).
- `--output` (Optional): Directory where the generated `.sql`  and `.csv` files will be saved. Default is  `./output`.

## Project Structure

```text
schema-aware-generator/
├── project/
│   ├── backend/
│   │   ├── parser/                # SQL DDL parsing
│   │   ├── mapper/                # LLM-to-Faker mapping
│   │   ├── generator/             # Data generation
│   │   └── exporter/              # File exports
│   ├── frontend/
│   │   └── assets/                # Static assets
│   ├── schemas/                   # Sample DDL files
│   └── output/                    # Generated test data
├── requirements.txt
├── README.md
├── .gitignore
└── .env
```
