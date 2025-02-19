exports[`class query > can query in bulk 1`] = `
{
  "http": {
    "headers": {}
  },
  "body": {
    "kind": "single",
    "singleResult": {
      "data": {
        "bulkClasses": [
          {
            "subject": "CS",
            "classId": "3500",
            "name": "OOD",
            "latestOccurrence": {
              "termId": "201930"
            }
          },
          {
            "subject": "CS",
            "classId": "2500",
            "name": "Fundamentals of Computer Science 1",
            "latestOccurrence": {
              "termId": "201930"
            }
          }
        ]
      }
    }
  }
}
`;

exports[`class query > gets all occurrences 1`] = `
{
  "http": {
    "headers": {}
  },
  "body": {
    "kind": "single",
    "singleResult": {
      "data": {
        "class": {
          "name": "Fundamentals of Computer Science 1",
          "allOccurrences": [
            {
              "termId": "201930"
            },
            {
              "termId": "201830"
            }
          ]
        }
      }
    }
  }
}
`;

exports[`class query > gets latest occurrence 1`] = `
{
  "http": {
    "headers": {}
  },
  "body": {
    "kind": "single",
    "singleResult": {
      "data": {
        "class": {
          "name": "Fundamentals of Computer Science 1",
          "latestOccurrence": {
            "termId": "201930"
          }
        }
      }
    }
  }
}
`;

exports[`class query > gets specific occurrence 1`] = `
{
  "http": {
    "headers": {}
  },
  "body": {
    "kind": "single",
    "singleResult": {
      "data": {
        "class": {
          "name": "Fundamentals of Computer Science 1",
          "occurrence": {
            "termId": "201930"
          }
        }
      }
    }
  }
}
`;

exports[`class query > gets the name of class from subject and classId 1`] = `
{
  "http": {
    "headers": {}
  },
  "body": {
    "kind": "single",
    "singleResult": {
      "data": {
        "class": {
          "name": "Fundamentals of Computer Science 1"
        }
      }
    }
  }
}
`;

exports[`classByHash query > gets class from class hash 1`] = `
{
  "http": {
    "headers": {}
  },
  "body": {
    "kind": "single",
    "singleResult": {
      "data": {
        "classByHash": {
          "name": "Fundamentals of Computer Science 1",
          "subject": "CS",
          "classId": "2500",
          "termId": "201830"
        }
      }
    }
  }
}
`;

exports[`sectionByHash query > gets section from section id 1`] = `
{
  "http": {
    "headers": {}
  },
  "body": {
    "kind": "single",
    "singleResult": {
      "data": {
        "sectionByHash": {
          "termId": "201830",
          "subject": "CS",
          "classId": "2500",
          "classType": "Lecture",
          "crn": "12345",
          "seatsCapacity": 5,
          "seatsRemaining": 2,
          "campus": "Boston",
          "honors": false,
          "meetings": {}
        }
      }
    }
  }
}
`;
