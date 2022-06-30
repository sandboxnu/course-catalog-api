## Scraping

Scraping is the core of SearchNEU, and of this API. "Scraping" refers to the process of fetching employee and course data, parsing it, and storing it.

## Overview

(Copy the following code block to a [Mermaid playground](https://mermaid.live/edit#eyJjb2RlIjoiZ3JhcGggVERcbiAgICBBW0NocmlzdG1hc10gLS0-fEdldCBtb25leXwgQihHbyBzaG9wcGluZylcbiAgICBCIC0tPiBDe0xldCBtZSB0aGlua31cbiAgICBDIC0tPnxPbmV8IERbTGFwdG9wXVxuICAgIEMgLS0-fFR3b3wgRVtpUGhvbmVdXG4gICAgQyAtLT58VGhyZWV8IEZbZmE6ZmEtY2FyIENhcl1cbiAgIiwibWVybWFpZCI6IntcbiAgXCJ0aGVtZVwiOiBcImRhcmtcIlxufSIsInVwZGF0ZUVkaXRvciI6ZmFsc2UsImF1dG9TeW5jIjp0cnVlLCJ1cGRhdGVEaWFncmFtIjpmYWxzZX0) if you can't view the diagram)

### High-level

```mermaid
flowchart TD
  A[Run scrapers] --> B[Determine which term IDs we want to scrape]
  B --> B2[Start scraping!]
  B2 --> C["Scrape publically-accessible Northeastern employee data"]
  B2 --> D[Scrape subjects, sections, and courses for the given terms]
  C --> E("Parse scraped data")
  D --> E
  E -.-> cache["If running locally, the results will be cached to speed up development"]
  E --> dump[Courses, sections, and employees are inserted into our database]
  dump --> DONE
  DONE["Inserts the courses into Elasticsearch, which allows for easy & efficient searching"]
```

### In-depth

```mermaid
flowchart TD
  A[yarn scrape] --> termIds
  subgraph termIds
    TERM_A[Determine which term IDs to scrape]
    TERM_A -.->|OR| TERM_F[User inputs the specific terms via CLI]
    TERM_F ---> TERM_DONE
    TERM_A -.->|OR| TERM_B(Query term IDs from Banner)
    TERM_B --> TERM_C("Filter the list of term IDs")
    TERM_C -.->|OR| TERM_D[Default - use the first 12]
    TERM_C -.->|OR| TERM_D2[User inputs the # to use via CLI]
    TERM_DONE(Returns list of terms to scrape)
    TERM_D --> TERM_DONE
    TERM_D2 --> TERM_DONE
  end

  subgraph employees
    EMP_F(Scrape HTML of college-specific websites)
    EMP_F -->|COE, CCIS, CAMD, CSSH| EMP_F2[Parse HTML, extract employee data]
    EMP_G("Query NEU Faculty directory API (REST)")
    EMP_F2 --> EMP_H(Merges employee results based on name & email)
    EMP_G -->|All NEU Employees| EMP_H

  end
  subgraph courses
    I("Query subject abbreviations from Banner [eg. HIST -> History]")
    I --> J(Query all sections from Banner)
    J --> J2("Map the sections to a list of courses (ie. subject + code)")
    J2 --> course
    subgraph course[For each course in the list...]
    direction TB
        K[Query course information from Banner]
        K --> L[Parse into a course object]
    end
  end

  subgraph dumpProcessor
    DMP_K[Courses, sections, and employees are inserted into our Prisma database]
  end

  termIds -->|Runs once, doesn't care about specific terms| employees
  termIds -->|Runs for each term in the terms list| courses

    employees --> dumpProcessor
    courses --> dumpProcessor
    dumpProcessor --> ES["Index data from Postgres into Elasticsearch, which allows for easy searching"]
    ES --> DONE["When users search on the website, the searching is handled by Elasticsearch"]
```
