import { createTestClient } from 'apollo-server-testing';
import { gql } from 'apollo-server';
import prisma from '../../prisma';
import server from '../index';

const { query } = createTestClient(server);

beforeAll(async () => {
  await prisma.major.deleteMany({});

  await prisma.major.create({
    data: {
      majorId: 'computer-information-science/computer-science/bscs',
      yearVersion: '2018',
      spec: { name: 'Computer Science, BSCS', yearVersion: 2018 },
      plansOfStudy: [{ years: [1000], id: '0' }],
    },
  });

  await prisma.major.create({
    data: {
      majorId: 'computer-information-science/computer-science/bscs',
      yearVersion: '2017',
      spec: { name: 'Computer Science, BSCS', yearVersion: 2017 },
      plansOfStudy: [{ years: [1000], id: '0' }],
    },
  });

  await prisma.major.create({
    data: {
      majorId: 'science/biochemistry/biochemistry-bs',
      yearVersion: '2018',
      spec: { name: 'Biochemistry, BS', yearVersion: 2018 },
      plansOfStudy: [{ years: [1000], id: '0' }],
    },
  });
});

it('gets major from majorId', async () => {
  const res = await query({
    query: gql`
      query major {
        major(majorId: "computer-information-science/computer-science/bscs") {
          majorId
        }
      }
    `,
  });
  expect(res).toMatchSnapshot();
});

it('gets specific occurrence', async () => {
  const res = await query({
    query: gql`
      query major {
        major(majorId: "computer-information-science/computer-science/bscs") {
          majorId
          occurrence(year: 2017) {
            yearVersion
            spec
            plansOfStudy
          }
        }
      }
    `,
  });

  expect(res).toMatchSnapshot();
});

it('gets latest occurrence', async () => {
  const res = await query({
    query: gql`
      query major {
        major(majorId: "computer-information-science/computer-science/bscs") {
          majorId
          latestOccurrence {
            yearVersion
            spec
          }
        }
      }
    `,
  });
  expect(res).toMatchSnapshot();
});

it('cannot find major from non-present majorId', async () => {
  const res = await query({
    query: gql`
      query major {
        major(majorId: "humanities/lovecraftian-studies/lovecraft-studies-ba") {
          majorId
          latestOccurrence {
            yearVersion
          }
        }
      }
    `,
  });
  expect(res).toMatchSnapshot();
});

it('cannot find majorOccurrence from non-present year', async () => {
  const res = await query({
    query: gql`
      query major {
        major(majorId: "computer-information-science/computer-science/bscs") {
          majorId
          occurrence(year: 1984) {
            spec
          }
        }
      }
    `,
  });
  expect(res).toMatchSnapshot();
});
